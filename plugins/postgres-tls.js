const BasePlugin = require('../lib/base-plugin');
const fs = require('fs');
const { execSync } = require('child_process');

class PostgresTlsPlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'postgres-tls';
    this.description = 'Extract TLS certificates from PostgreSQL configuration';
    this.requiredParams = [];
  }

  async collect(config) {
    this.validateConfig(config);
    
    const certificates = [];
    const dataDir = config.dataDir || '/var/lib/postgresql/data';
    const certFile = config.certFile || `${dataDir}/server.crt`;
    const keyFile = config.keyFile || `${dataDir}/server.key`;
    
    try {
      if (fs.existsSync(certFile)) {
        const cert = this.parseCertificateFile(certFile, config);
        if (cert) certificates.push(cert);
      }
      
      return certificates;
    } catch (error) {
      throw new Error(`Failed to extract PostgreSQL TLS certificates: ${error.message}`);
    }
  }

  parseCertificateFile(certPath, config) {
    const tempFile = `/tmp/postgres_cert_${Date.now()}.pem`;
    
    try {
      const content = fs.readFileSync(certPath, 'utf8');
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
      const domain = cnMatch ? cnMatch[1].trim() : 'postgresql-server';
      
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
          cert_path: certPath,
          service: 'postgresql'
        }
      });
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }
}

module.exports = PostgresTlsPlugin;