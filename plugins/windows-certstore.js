const BasePlugin = require('../lib/base-plugin');
const { execSync } = require('child_process');
const fs = require('fs');

class WindowsCertStorePlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'windows-certstore';
    this.description = 'Extract certificates from Windows Certificate Store';
    this.requiredParams = [];
  }

  async collect(config) {
    this.validateConfig(config);
    
    if (process.platform !== 'win32') {
      throw new Error('Windows Certificate Store plugin only works on Windows');
    }
    
    const certificates = [];
    const store = config.store || 'My';
    const location = config.location || 'CurrentUser';
    
    try {
      // Use PowerShell to get certificates
      const psScript = `
        Get-ChildItem -Path "Cert:\\${location}\\${store}" | 
        Where-Object { $_.HasPrivateKey -eq $false -or $_.HasPrivateKey -eq $true } |
        ForEach-Object {
          $cert = $_
          $base64 = [Convert]::ToBase64String($cert.RawData)
          Write-Output "-----BEGIN CERTIFICATE-----"
          for ($i = 0; $i -lt $base64.Length; $i += 64) {
            $line = $base64.Substring($i, [Math]::Min(64, $base64.Length - $i))
            Write-Output $line
          }
          Write-Output "-----END CERTIFICATE-----"
          Write-Output "CERT_SEPARATOR"
        }
      `;
      
      const output = execSync(`powershell -Command "${psScript}"`, { encoding: 'utf8' });
      const certBlocks = output.split('CERT_SEPARATOR').filter(block => block.trim());
      
      for (let i = 0; i < certBlocks.length; i++) {
        try {
          const cert = this.parseCertificate(certBlocks[i].trim(), store, location, i, config);
          if (cert) certificates.push(cert);
        } catch (error) {
          console.error(`✗ Failed to parse certificate ${i}: ${error.message}`);
        }
      }
      
      return certificates;
    } catch (error) {
      throw new Error(`Failed to access Windows Certificate Store: ${error.message}`);
    }
  }

  parseCertificate(certData, store, location, index, config) {
    const tempFile = `C:\\temp\\win_cert_${Date.now()}_${index}.pem`;
    
    try {
      fs.writeFileSync(tempFile, certData);
      
      const output = execSync(`openssl x509 -in "${tempFile}" -text -noout`, { encoding: 'utf8' });
      
      const subjectMatch = output.match(/Subject: (.+)/);
      const issuerMatch = output.match(/Issuer: (.+)/);
      const notBeforeMatch = output.match(/Not Before: (.+)/);
      const notAfterMatch = output.match(/Not After : (.+)/);
      const serialMatch = output.match(/Serial Number:\\s*([a-f0-9:]+)/i);
      const sanMatch = output.match(/DNS:([^,\\s]+)/g);
      
      const subject = subjectMatch ? subjectMatch[1] : '';
      const cnMatch = subject.match(/CN\\s*=\\s*([^,]+)/);
      const domain = cnMatch ? cnMatch[1].trim() : `windows-cert-${index}`;
      
      const issuer = issuerMatch ? issuerMatch[1] : '';
      const issuerCnMatch = issuer.match(/CN\\s*=\\s*([^,]+)/);
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
          windows_store: store,
          windows_location: location,
          cert_index: index
        }
      });
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }
}

module.exports = WindowsCertStorePlugin;