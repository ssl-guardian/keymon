const BasePlugin = require('../lib/base-plugin');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class NginxPlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'nginx';
    this.description = 'Extract certificates from Nginx configuration files';
    this.requiredParams = ['configPath'];
  }

  async collect(config) {
    this.validateConfig(config);
    
    const certificates = [];
    const configPath = config.configPath;
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Nginx config path does not exist: ${configPath}`);
    }
    
    const configFiles = this.findConfigFiles(configPath);
    
    for (const configFile of configFiles) {
      try {
        const certs = this.parseNginxConfig(configFile, config);
        certificates.push(...certs);
      } catch (error) {
        console.error(`✗ Failed to parse ${configFile}: ${error.message}`);
      }
    }
    
    return certificates;
  }

  findConfigFiles(configPath) {
    const files = [];
    const stat = fs.statSync(configPath);
    
    if (stat.isFile()) {
      files.push(configPath);
    } else if (stat.isDirectory()) {
      const entries = fs.readdirSync(configPath);
      for (const entry of entries) {
        const fullPath = path.join(configPath, entry);
        const entryStat = fs.statSync(fullPath);
        
        if (entryStat.isFile() && (entry.endsWith('.conf') || entry.includes('nginx'))) {
          files.push(fullPath);
        }
      }
    }
    
    return files;
  }

  parseNginxConfig(configFile, config) {
    const certificates = [];
    const content = fs.readFileSync(configFile, 'utf8');
    
    // Find SSL certificate directives
    const sslCertRegex = /ssl_certificate\s+([^;]+);/g;
    const serverNameRegex = /server_name\s+([^;]+);/g;
    
    let match;
    const certPaths = [];
    const serverNames = [];
    
    while ((match = sslCertRegex.exec(content)) !== null) {
      certPaths.push(match[1].trim().replace(/['"]/g, ''));
    }
    
    while ((match = serverNameRegex.exec(content)) !== null) {
      const names = match[1].trim().split(/\s+/).map(name => name.replace(/['"]/g, ''));
      serverNames.push(...names);
    }
    
    for (const certPath of certPaths) {
      try {
        if (fs.existsSync(certPath)) {
          const cert = this.parseCertificateFile(certPath, serverNames, config);
          if (cert) certificates.push(cert);
        }
      } catch (error) {
        console.error(`✗ Failed to parse certificate ${certPath}: ${error.message}`);
      }
    }
    
    return certificates;
  }

  parseCertificateFile(certPath, serverNames, config) {
    const tempFile = `/tmp/nginx_cert_${Date.now()}.pem`;
    
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
      const domain = cnMatch ? cnMatch[1].trim() : (serverNames[0] || path.basename(certPath));
      
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
          server_names: serverNames.join(', ')
        }
      });
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }
}

module.exports = NginxPlugin;