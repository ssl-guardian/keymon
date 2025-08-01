const BasePlugin = require('../lib/base-plugin');
const { execSync } = require('child_process');
const fs = require('fs');

class MacOSKeychainPlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'macos-keychain';
    this.description = 'Extract certificates from macOS Keychain';
    this.requiredParams = [];
  }

  async collect(config) {
    this.validateConfig(config);
    
    const certificates = [];
    const keychain = config.keychain || 'System.keychain';
    
    try {
      // Find certificates in keychain
      const findOutput = execSync(
        `security find-certificate -a -p ${keychain}`,
        { encoding: 'utf8' }
      );
      
      // Split into individual certificates
      const certBlocks = findOutput.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
      
      if (!certBlocks) {
        return certificates;
      }
      
      for (let i = 0; i < certBlocks.length; i++) {
        try {
          const cert = this.parseCertificate(certBlocks[i], keychain, i, config);
          if (cert) certificates.push(cert);
        } catch (error) {
          console.error(`✗ Failed to parse certificate ${i}: ${error.message}`);
        }
      }
      
      return certificates;
    } catch (error) {
      throw new Error(`Failed to access macOS keychain: ${error.message}`);
    }
  }

  parseCertificate(certData, keychain, index, config) {
    const tempFile = `/tmp/macos_cert_${Date.now()}_${index}.pem`;
    
    try {
      fs.writeFileSync(tempFile, certData);
      
      const output = execSync(`openssl x509 -in "${tempFile}" -text -noout`, { encoding: 'utf8' });
      
      const subjectMatch = output.match(/Subject: (.+)/);
      const issuerMatch = output.match(/Issuer: (.+)/);
      const notBeforeMatch = output.match(/Not Before: (.+)/);
      const notAfterMatch = output.match(/Not After : (.+)/);
      const serialMatch = output.match(/Serial Number:\s*([a-f0-9:]+)/i);
      const sanMatch = output.match(/DNS:([^,\s]+)/g);
      
      const subject = subjectMatch ? subjectMatch[1] : '';
      const cnMatch = subject.match(/CN\s*=\s*([^,]+)/);
      const domain = cnMatch ? cnMatch[1].trim() : `keychain-cert-${index}`;
      
      const issuer = issuerMatch ? issuerMatch[1] : '';
      const issuerCnMatch = issuer.match(/CN\s*=\s*([^,]+)/);
      const issuerName = issuerCnMatch ? issuerCnMatch[1].trim() : 'Unknown';
      
      const validFrom = notBeforeMatch ? new Date(notBeforeMatch[1]) : new Date();
      const validTo = notAfterMatch ? new Date(notAfterMatch[1]) : new Date();
      const san = sanMatch ? sanMatch.map(s => s.replace('DNS:', '')) : [domain];
      
      const sha1 = execSync(`openssl x509 -in "${tempFile}" -fingerprint -noout`, { encoding: 'utf8' }).match(/Fingerprint=(.+)/)?.[1];
      const sha256 = execSync(`openssl x509 -in "${tempFile}" -fingerprint -sha256 -noout`, { encoding: 'utf8' }).match(/Fingerprint=(.+)/)?.[1];
      
      return this.createCertificate({
        domain,
        issuer: issuerName,
        expiration_date: validTo,
        valid_from: validFrom,
        subject: domain,
        san,
        fingerprint: sha1,
        fingerprint256: sha256,
        serial_number: serialMatch ? serialMatch[1] : '',
        environment: config.environment,
        group: config.group,
        tags: {
          keychain: keychain,
          keychain_index: index
        }
      });
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }
}

module.exports = MacOSKeychainPlugin;