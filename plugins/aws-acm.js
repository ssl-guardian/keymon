const BasePlugin = require('../lib/base-plugin');
const https = require('https');
const crypto = require('crypto');

class AwsAcmPlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'aws-acm';
    this.description = 'Extract certificates from AWS Certificate Manager';
    this.requiredParams = ['accessKeyId', 'secretAccessKey'];
  }

  async collect(config) {
    this.validateConfig(config);
    
    const certificates = [];
    const region = config.region || 'us-east-1';
    
    try {
      const certList = await this.listCertificates(region, config);
      
      for (const cert of certList.CertificateSummaryList || []) {
        try {
          const certDetails = await this.getCertificateDetails(cert.CertificateArn, region, config);
          if (certDetails) certificates.push(certDetails);
        } catch (error) {
          console.error(`✗ Failed to get details for ${cert.DomainName}: ${error.message}`);
        }
      }
      
      return certificates;
    } catch (error) {
      throw new Error(`Failed to fetch AWS ACM certificates: ${error.message}`);
    }
  }

  async awsRequest(service, target, payload, region, config) {
    const host = `${service}.${region}.amazonaws.com`;
    const method = 'POST';
    const canonicalUri = '/';
    const canonicalQuerystring = '';
    const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');
    
    const amzDate = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substr(0, 8);
    
    const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\nx-amz-target:${target}\n`;
    const signedHeaders = 'host;x-amz-date;x-amz-target';
    const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;
    
    const signingKey = this.getSignatureKey(config.secretAccessKey, dateStamp, region, service);
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    
    const authorizationHeader = `${algorithm} Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: host,
        port: 443,
        path: canonicalUri,
        method: method,
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Date': amzDate,
          'X-Amz-Target': target,
          'Authorization': authorizationHeader,
          'Content-Length': payload.length
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error(`Failed to parse AWS response: ${error.message}`));
          }
        });
      });
      
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  getSignatureKey(key, dateStamp, regionName, serviceName) {
    const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    return kSigning;
  }

  async listCertificates(region, config) {
    const payload = JSON.stringify({});
    return await this.awsRequest('acm', 'CertificateManager.ListCertificates', payload, region, config);
  }

  async getCertificateDetails(arn, region, config) {
    try {
      const payload = JSON.stringify({ CertificateArn: arn });
      const response = await this.awsRequest('acm', 'CertificateManager.DescribeCertificate', payload, region, config);
      const cert = response.Certificate;
      
      return this.createCertificate({
        domain: cert.DomainName,
        issuer: cert.Issuer || 'Amazon',
        expiration_date: new Date(cert.NotAfter),
        valid_from: new Date(cert.NotBefore),
        subject: cert.Subject || cert.DomainName,
        san: cert.SubjectAlternativeNames || [cert.DomainName],
        fingerprint: cert.Options?.CertificateTransparencyLoggingPreference,
        fingerprint256: cert.Serial,
        serial_number: cert.Serial,
        environment: config.environment,
        group: config.group,
        tags: {
          aws_arn: arn,
          aws_region: region,
          aws_status: cert.Status,
          aws_type: cert.Type,
          aws_key_algorithm: cert.KeyAlgorithm
        }
      });
    } catch (error) {
      throw new Error(`Failed to get certificate details: ${error.message}`);
    }
  }
}

module.exports = AwsAcmPlugin;