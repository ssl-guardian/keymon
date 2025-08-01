const BasePlugin = require('../lib/base-plugin');
const https = require('https');

class DomainPlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'domain';
    this.description = 'Fetch certificates from live HTTPS domains';
    this.requiredParams = ['domains'];
  }

  async collect(config) {
    this.validateConfig(config);
    
    const certificates = [];
    const domains = Array.isArray(config.domains) ? config.domains : [config.domains];
    
    for (const domain of domains) {
      try {
        const cert = await this.fetchCertificateInfo(domain, config);
        certificates.push(cert);
        console.log(`✓ Successfully fetched certificate for ${domain}`);
      } catch (error) {
        console.error(`✗ Failed to fetch certificate for ${domain}: ${error.message}`);
      }
    }
    
    return certificates;
  }

  async fetchCertificateInfo(domain, config) {
    return new Promise((resolve, reject) => {
      const [hostname, portStr] = domain.includes(':') ? domain.split(':') : [domain, '443'];
      const port = parseInt(portStr) || 443;
      
      const options = {
        host: hostname,
        port: port,
        method: 'GET',
        rejectUnauthorized: false,
        timeout: 10000
      };
      
      const req = https.request(options, (res) => {
        try {
          const cert = res.socket.getPeerCertificate(true);
          
          if (cert && cert.valid_to) {
            const san = cert.subjectaltname ? 
              cert.subjectaltname.split(', ').map(s => s.replace('DNS:', '')) : 
              [hostname];
            
            resolve(this.createCertificate({
              domain,
              issuer: cert.issuer?.CN || cert.issuer?.O || 'Unknown',
              expiration_date: new Date(cert.valid_to),
              valid_from: new Date(cert.valid_from),
              subject: cert.subject?.CN || hostname,
              san,
              fingerprint: cert.fingerprint,
              fingerprint256: cert.fingerprint256,
              serial_number: cert.serialNumber,
              environment: config.environment,
              group: config.group
            }));
          } else {
            reject(new Error(`No valid certificate found for ${domain}`));
          }
        } catch (error) {
          reject(error);
        }
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout connecting to ${domain}`));
      });
      
      req.setTimeout(10000);
      req.end();
    });
  }
}

module.exports = DomainPlugin;