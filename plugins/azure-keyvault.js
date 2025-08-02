const BasePlugin = require('../lib/base-plugin');
const https = require('https');

class AzureKeyVaultPlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'azure-keyvault';
    this.description = 'Extract certificates from Azure Key Vault';
    this.requiredParams = ['vaultName', 'clientId', 'clientSecret', 'tenantId'];
  }

  async collect(config) {
    this.validateConfig(config);
    
    const certificates = [];
    const accessToken = await this.getAccessToken(config);
    
    try {
      const certList = await this.listCertificates(config.vaultName, accessToken);
      
      for (const cert of certList.value || []) {
        try {
          const certDetails = await this.getCertificateDetails(cert.id, accessToken, config);
          if (certDetails) certificates.push(certDetails);
        } catch (error) {
          console.error(`✗ Failed to get details for ${cert.id}: ${error.message}`);
        }
      }
      
      return certificates;
    } catch (error) {
      throw new Error(`Failed to fetch Azure Key Vault certificates: ${error.message}`);
    }
  }

  createRequestOptions(url, method, headers = {}) {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    const options = { method, headers };
    
    if (proxyUrl) {
      const proxy = new URL(proxyUrl);
      const target = new URL(url);
      
      options.hostname = proxy.hostname;
      options.port = proxy.port;
      options.path = target.href;
      options.headers['Host'] = target.hostname;
      
      if (proxy.username && proxy.password) {
        const auth = Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64');
        options.headers['Proxy-Authorization'] = `Basic ${auth}`;
      }
    } else {
      const target = new URL(url);
      options.hostname = target.hostname;
      options.port = target.port;
      options.path = target.pathname + target.search;
    }
    
    return options;
  }

  async getAccessToken(config) {
    const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
    const postData = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: 'https://vault.azure.net/.default',
      grant_type: 'client_credentials'
    }).toString();

    return new Promise((resolve, reject) => {
      const options = this.createRequestOptions(tokenUrl, 'POST', {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length
      });
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.access_token) {
              resolve(response.access_token);
            } else {
              reject(new Error(`Authentication failed: ${response.error_description || 'Unknown error'}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse token response: ${error.message}`));
          }
        });
      });
      
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async listCertificates(vaultName, accessToken) {
    const url = `https://${vaultName}.vault.azure.net/certificates?api-version=7.4`;
    
    return new Promise((resolve, reject) => {
      const options = this.createRequestOptions(url, 'GET', {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      });
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error(`Failed to parse certificates list: ${error.message}`));
          }
        });
      });
      
      req.on('error', reject);
      req.end();
    });
  }

  async getCertificateDetails(certId, accessToken, config) {
    return new Promise((resolve, reject) => {
      const options = this.createRequestOptions(`${certId}?api-version=7.4`, 'GET', {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      });
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const cert = JSON.parse(data);
            
            const notBefore = cert.attributes?.nbf ? new Date(cert.attributes.nbf * 1000) : new Date();
            const expires = cert.attributes?.exp ? new Date(cert.attributes.exp * 1000) : new Date();
            
            const subject = cert.policy?.x509_certificate_properties?.subject || cert.id.split('/').pop();
            const subjectCn = subject.match(/CN=([^,]+)/)?.[1] || cert.id.split('/').pop();
            const sanDns = cert.policy?.x509_certificate_properties?.subject_alternative_names?.dns_names || [subjectCn];
            
            resolve(this.createCertificate({
              domain: subjectCn,
              issuer: cert.policy?.issuer_parameters?.name || 'Azure Key Vault',
              expiration_date: expires,
              valid_from: notBefore,
              subject: subjectCn,
              san: sanDns,
              fingerprint: cert.x509_thumbprint,
              fingerprint256: cert.x509_thumbprint_hex,
              serial_number: cert.sid,
              environment: config.environment,
              group: config.group,
              tags: {
                azure_vault: config.vaultName,
                azure_cert_id: cert.id,
                azure_enabled: cert.attributes?.enabled,
                azure_created: cert.attributes?.created ? new Date(cert.attributes.created * 1000).toISOString() : null
              }
            }));
          } catch (error) {
            reject(new Error(`Failed to parse certificate details: ${error.message}`));
          }
        });
      });
      
      req.on('error', reject);
      req.end();
    });
  }
}

module.exports = AzureKeyVaultPlugin;