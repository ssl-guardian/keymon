const BasePlugin = require('../lib/base-plugin');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class KeystorePlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'keystore';
    this.description = 'Extract certificates from Java keystores (.jks, .p12, .pfx)';
    this.requiredParams = ['keystores'];
  }

  async collect(config) {
    this.validateConfig(config);
    
    const certificates = [];
    const keystores = Array.isArray(config.keystores) ? config.keystores : [config.keystores];
    
    for (const keystorePath of keystores) {
      try {
        const certs = await this.extractKeystoreInfo(keystorePath, config);
        certificates.push(...certs);
        console.log(`✓ Successfully extracted ${certs.length} certificates from ${keystorePath}`);
      } catch (error) {
        console.error(`✗ Failed to extract certificates from ${keystorePath}: ${error.message}`);
      }
    }
    
    return certificates;
  }

  async extractKeystoreInfo(keystorePath, config) {
    try {
      const password = config.password || process.env.KEYSTORE_PASSWORD || 'changeit';
      const keystoreData = fs.readFileSync(keystorePath);
      const ext = path.extname(keystorePath).toLowerCase();
      
      let certificates = [];
      
      if (ext === '.p12' || ext === '.pfx') {
        certificates = await this.parsePKCS12(keystoreData, password, keystorePath, config);
      } else if (ext === '.jks') {
        certificates = await this.parseJKS(keystoreData, password, keystorePath, config);
      } else {
        // Try PKCS12 first, then JKS
        try {
          certificates = await this.parsePKCS12(keystoreData, password, keystorePath, config);
        } catch (p12Error) {
          certificates = await this.parseJKS(keystoreData, password, keystorePath, config);
        }
      }
      
      return certificates;
    } catch (error) {
      throw new Error(`Failed to extract keystore info: ${error.message}`);
    }
  }

  async parsePKCS12(keystoreData, password, keystorePath, config) {
    try {
      // Simple PKCS12 parsing - in production, you'd use a proper library like 'node-forge'
      const certificates = [];
      
      // For now, we'll use a basic approach that works with most PKCS12 files
      // This is a simplified implementation - a full implementation would use ASN.1 parsing
      
      // Extract certificates using OpenSSL-style parsing but with Node.js crypto
      const tempP12 = `/tmp/keystore_${Date.now()}.p12`;
      const tempPem = `/tmp/keystore_${Date.now()}.pem`;
      
      try {
        fs.writeFileSync(tempP12, keystoreData);
        
        // Use openssl command as fallback for complex parsing
        const { execSync } = require('child_process');
        execSync(`openssl pkcs12 -in "${tempP12}" -out "${tempPem}" -nodes -passin pass:"${password}"`, { stdio: 'ignore' });
        
        const pemData = fs.readFileSync(tempPem, 'utf8');
        const certBlocks = pemData.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
        
        if (certBlocks) {
          for (let i = 0; i < certBlocks.length; i++) {
            const cert = this.parsePEMCertificate(certBlocks[i], `pkcs12-cert-${i}`, keystorePath, config);
            if (cert) certificates.push(cert);
          }
        }
      } finally {
        if (fs.existsSync(tempP12)) fs.unlinkSync(tempP12);
        if (fs.existsSync(tempPem)) fs.unlinkSync(tempPem);
      }
      
      return certificates;
    } catch (error) {
      throw new Error(`Failed to parse PKCS12 keystore: ${error.message}`);
    }
  }

  async parseJKS(keystoreData, password, keystorePath, config) {
    try {
      // JKS parsing is more complex - for now use a hybrid approach
      // In production, you'd use a proper JKS parser library
      
      const certificates = [];
      const tempJks = `/tmp/keystore_${Date.now()}.jks`;
      
      try {
        fs.writeFileSync(tempJks, keystoreData);
        
        // Use keytool as fallback for JKS parsing
        const { execSync } = require('child_process');
        
        // Try to list certificates
        try {
          const output = execSync(`keytool -list -v -keystore "${tempJks}" -storepass "${password}"`, { encoding: 'utf8' });
          return this.parseKeytoolOutput(output, keystorePath, config);
        } catch (keytoolError) {
          // If keytool fails, try to convert to PKCS12 first
          const tempP12 = `/tmp/keystore_${Date.now()}.p12`;
          try {
            execSync(`keytool -importkeystore -srckeystore "${tempJks}" -srcstorepass "${password}" -destkeystore "${tempP12}" -deststorepass "${password}" -deststoretype PKCS12`, { stdio: 'ignore' });
            const p12Data = fs.readFileSync(tempP12);
            return await this.parsePKCS12(p12Data, password, keystorePath, config);
          } finally {
            if (fs.existsSync(tempP12)) fs.unlinkSync(tempP12);
          }
        }
      } finally {
        if (fs.existsSync(tempJks)) fs.unlinkSync(tempJks);
      }
      
      return certificates;
    } catch (error) {
      throw new Error(`Failed to parse JKS keystore: ${error.message}`);
    }
  }

  parseKeytoolOutput(output, keystorePath, config) {
    const certificates = [];
    const aliases = output.match(/Alias name: (.*?)$/gm);
    
    if (!aliases) {
      throw new Error('No certificates found in keystore');
    }
    
    for (const aliasLine of aliases) {
      const alias = aliasLine.replace('Alias name: ', '').trim();
      const certSection = output.split(aliasLine)[1].split('Alias name:')[0];
      
      const ownerMatch = certSection.match(/Owner: (.*?)$/m);
      const issuerMatch = certSection.match(/Issuer: (.*?)$/m);
      const validFromMatch = certSection.match(/Valid from: (.*?) until: (.*?)$/m);
      const serialMatch = certSection.match(/Serial number: (.*?)$/m);
      
      if (ownerMatch && issuerMatch && validFromMatch) {
        const owner = ownerMatch[1];
        const issuer = issuerMatch[1];
        const validFrom = new Date(validFromMatch[1]);
        const validUntil = new Date(validFromMatch[2]);
        const serial = serialMatch ? serialMatch[1] : '';
        
        const cnMatch = owner.match(/CN=(.*?)(,|$)/);
        const domain = cnMatch ? cnMatch[1] : path.basename(keystorePath) + '-' + alias;
        
        certificates.push(this.createCertificate({
          domain,
          issuer: issuer.match(/CN=(.*?)(,|$)/) ? issuer.match(/CN=(.*?)(,|$)/)[1] : 'Unknown',
          expiration_date: validUntil,
          valid_from: validFrom,
          subject: domain,
          san: [domain],
          serial_number: serial,
          environment: config.environment,
          group: config.group,
          tags: {
            keystore_path: keystorePath,
            keystore_alias: alias
          }
        }));
      }
    }
    
    return certificates;
  }

  parsePEMCertificate(pemData, alias, keystorePath, config) {
    try {
      // Parse PEM certificate using Node.js crypto
      const cert = crypto.X509Certificate ? new crypto.X509Certificate(pemData) : null;
      
      if (cert) {
        const subject = cert.subject;
        const issuer = cert.issuer;
        const validFrom = new Date(cert.validFrom);
        const validTo = new Date(cert.validTo);
        
        const cnMatch = subject.match(/CN=([^,]+)/);
        const domain = cnMatch ? cnMatch[1].trim() : alias;
        
        const issuerCnMatch = issuer.match(/CN=([^,]+)/);
        const issuerName = issuerCnMatch ? issuerCnMatch[1].trim() : 'Unknown';
        
        return this.createCertificate({
          domain,
          issuer: issuerName,
          expiration_date: validTo,
          valid_from: validFrom,
          subject: domain,
          san: cert.subjectAltName ? cert.subjectAltName.split(', ').map(s => s.replace('DNS:', '')) : [domain],
          fingerprint: cert.fingerprint,
          fingerprint256: cert.fingerprint256,
          serial_number: cert.serialNumber,
          environment: config.environment,
          group: config.group,
          tags: {
            keystore_path: keystorePath,
            keystore_alias: alias
          }
        });
      }
      
      return null;
    } catch (error) {
      console.error(`Failed to parse PEM certificate: ${error.message}`);
      return null;
    }
  }
}

module.exports = KeystorePlugin;