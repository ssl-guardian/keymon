const BasePlugin = require('../lib/base-plugin');
const fs = require('fs');
const { execSync } = require('child_process');

class PkiBundlePlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'pki-bundle';
    this.description = 'Parse multi-certificate CA bundles';
    this.requiredParams = ['bundles'];
  }

  async collect(config) {
    this.validateConfig(config);
    
    const certificates = [];
    const bundles = Array.isArray(config.bundles) ? config.bundles : [config.bundles];
    
    for (const bundlePath of bundles) {
      try {
        const certs = await this.parsePkiBundle(bundlePath, config);
        certificates.push(...certs);
        console.log(`✓ Successfully parsed ${certs.length} certificates from PKI bundle ${bundlePath}`);
      } catch (error) {
        console.error(`✗ Failed to parse PKI bundle ${bundlePath}: ${error.message}`);
      }
    }
    
    return certificates;
  }

  async parsePkiBundle(bundlePath, config) {
    if (!fs.existsSync(bundlePath)) {
      throw new Error('CA bundle file does not exist');
    }
    
    const content = fs.readFileSync(bundlePath, 'utf8');
    const certificates = [];
    
    const certBlocks = content.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
    
    if (!certBlocks) {
      throw new Error('No certificates found in CA bundle');
    }
    
    for (let i = 0; i < certBlocks.length; i++) {
      const certBlock = certBlocks[i];
      const tempFile = `/tmp/pki_cert_${Date.now()}_${i}.pem`;
      
      try {
        fs.writeFileSync(tempFile, certBlock);
        
        const output = execSync(`openssl x509 -in "${tempFile}" -text -noout`, { encoding: 'utf8' });
        
        const subjectMatch = output.match(/Subject: (.+)/);
        const issuerMatch = output.match(/Issuer: (.+)/);
        const notBeforeMatch = output.match(/Not Before: (.+)/);
        const notAfterMatch = output.match(/Not After : (.+)/);
        const serialMatch = output.match(/Serial Number:\s*([a-f0-9:]+)/i);
        
        const subject = subjectMatch ? subjectMatch[1] : '';
        const cnMatch = subject.match(/CN\s*=\s*([^,]+)/);
        const domain = cnMatch ? cnMatch[1].trim() : `pki-cert-${i}`;
        
        const issuer = issuerMatch ? issuerMatch[1] : '';
        const issuerCnMatch = issuer.match(/CN\s*=\s*([^,]+)/);
        const issuerName = issuerCnMatch ? issuerCnMatch[1].trim() : 'Unknown';
        
        const validFrom = notBeforeMatch ? new Date(notBeforeMatch[1]) : new Date();
        const validTo = notAfterMatch ? new Date(notAfterMatch[1]) : new Date();
        
        const sha1 = execSync(`openssl x509 -in "${tempFile}" -fingerprint -noout`, { encoding: 'utf8' }).match(/Fingerprint=(.+)/)?.[1];
        const sha256 = execSync(`openssl x509 -in "${tempFile}" -fingerprint -sha256 -noout`, { encoding: 'utf8' }).match(/Fingerprint=(.+)/)?.[1];
        
        certificates.push(this.createCertificate({
          domain,
          issuer: issuerName,
          expiration_date: validTo,
          valid_from: validFrom,
          subject: domain,
          san: [domain],
          fingerprint: sha1,
          fingerprint256: sha256,
          serial_number: serialMatch ? serialMatch[1] : '',
          environment: config.environment,
          group: config.group,
          tags: {
            bundle_path: bundlePath,
            bundle_index: i
          }
        }));
        
        console.log(`✓ Parsed PKI certificate: ${domain}`);
      } catch (error) {
        console.error(`✗ Failed to parse certificate ${i} in bundle: ${error.message}`);
      } finally {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    }
    
    return certificates;
  }
}

module.exports = PkiBundlePlugin;