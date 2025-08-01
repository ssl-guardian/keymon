const BasePlugin = require('../lib/base-plugin');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class CertFolderPlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'cert-folder';
    this.description = 'Parse certificate files from directories';
    this.requiredParams = ['folders'];
  }

  async collect(config) {
    this.validateConfig(config);
    
    const certificates = [];
    const folders = Array.isArray(config.folders) ? config.folders : [config.folders];
    
    for (const folderPath of folders) {
      try {
        const certs = await this.scanCertificateFolder(folderPath, config);
        certificates.push(...certs);
        console.log(`✓ Successfully scanned ${certs.length} certificates from ${folderPath}`);
      } catch (error) {
        console.error(`✗ Failed to scan certificates from ${folderPath}: ${error.message}`);
      }
    }
    
    return certificates;
  }

  async scanCertificateFolder(folderPath, config) {
    if (!fs.existsSync(folderPath)) {
      throw new Error('Folder does not exist');
    }
    
    const certificates = [];
    const files = fs.readdirSync(folderPath);
    const certExtensions = ['.pem', '.crt', '.cer', '.cert', '.p7b', '.p7c'];
    
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isFile()) {
        const ext = path.extname(file).toLowerCase();
        
        if (certExtensions.includes(ext)) {
          try {
            const cert = this.parseCertificateFile(filePath, config);
            certificates.push(cert);
            console.log(`✓ Parsed certificate: ${cert.domain}`);
          } catch (error) {
            console.error(`✗ Failed to parse ${file}: ${error.message}`);
          }
        }
      }
    }
    
    return certificates;
  }

  parseCertificateFile(filePath, config) {
    const tempFile = `/tmp/cert_${Date.now()}.pem`;
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const certMatch = content.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
      
      if (!certMatch) {
        throw new Error('No certificate found in file');
      }
      
      fs.writeFileSync(tempFile, certMatch[0]);
      
      const output = execSync(`openssl x509 -in "${tempFile}" -text -noout`, { encoding: 'utf8' });
      
      const subjectMatch = output.match(/Subject: (.+)/);
      const issuerMatch = output.match(/Issuer: (.+)/);
      const notBeforeMatch = output.match(/Not Before: (.+)/);
      const notAfterMatch = output.match(/Not After : (.+)/);
      const serialMatch = output.match(/Serial Number:\s*([a-f0-9:]+)/i);
      const sanMatch = output.match(/DNS:([^,\s]+)/g);
      
      const subject = subjectMatch ? subjectMatch[1] : '';
      const cnMatch = subject.match(/CN\s*=\s*([^,]+)/);
      const domain = cnMatch ? cnMatch[1].trim() : path.basename(filePath, path.extname(filePath));
      
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
          file_path: filePath,
          file_name: path.basename(filePath)
        }
      });
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }
}

module.exports = CertFolderPlugin;