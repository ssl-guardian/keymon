const BasePlugin = require('../lib/base-plugin');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

class K8sSecretsPlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'k8s-secrets';
    this.description = 'Extract certificates from Kubernetes TLS secrets';
    this.requiredParams = [];
  }

  async collect(config) {
    this.validateConfig(config);
    
    const certificates = [];
    const k8sConfig = this.loadKubeConfig(config.kubeconfig);
    
    try {
      const namespaces = config.namespace ? [config.namespace] : await this.getNamespaces(k8sConfig);
      
      for (const namespace of namespaces) {
        const secrets = await this.getTlsSecrets(namespace, k8sConfig);
        
        for (const secret of secrets.items || []) {
          try {
            if (secret.data && secret.data['tls.crt']) {
              const certData = Buffer.from(secret.data['tls.crt'], 'base64').toString('utf8');
              const cert = this.parseCertificate(certData, secret, config);
              if (cert) certificates.push(cert);
            }
          } catch (error) {
            console.error(`✗ Failed to parse secret ${secret.metadata.name}: ${error.message}`);
          }
        }
      }
      
      return certificates;
    } catch (error) {
      throw new Error(`Failed to fetch Kubernetes secrets: ${error.message}`);
    }
  }

  loadKubeConfig(kubeconfigPath) {
    const configPath = kubeconfigPath || path.join(os.homedir(), '.kube', 'config');
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Kubeconfig not found at ${configPath}`);
    }
    
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = require('js-yaml').load ? require('js-yaml').load(configContent) : JSON.parse(configContent);
    
    const currentContext = config.contexts.find(ctx => ctx.name === config['current-context']);
    const cluster = config.clusters.find(cls => cls.name === currentContext.context.cluster);
    const user = config.users.find(usr => usr.name === currentContext.context.user);
    
    return {
      server: cluster.cluster.server,
      token: user.user.token,
      cert: user.user['client-certificate-data'],
      key: user.user['client-key-data'],
      ca: cluster.cluster['certificate-authority-data']
    };
  }

  createRequestOptions(url, method, headers = {}) {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    const options = { method, headers, rejectUnauthorized: false };
    
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
      options.port = target.port || 443;
      options.path = target.pathname + target.search;
    }
    
    return options;
  }

  async k8sRequest(path, k8sConfig) {
    const url = new URL(path, k8sConfig.server);
    
    const options = this.createRequestOptions(url.href, 'GET', {
      'Authorization': `Bearer ${k8sConfig.token}`,
      'Accept': 'application/json'
    });
    
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error(`Failed to parse Kubernetes response: ${error.message}`));
          }
        });
      });
      
      req.on('error', reject);
      req.end();
    });
  }

  async getNamespaces(k8sConfig) {
    const response = await this.k8sRequest('/api/v1/namespaces', k8sConfig);
    return response.items.map(ns => ns.metadata.name);
  }

  async getTlsSecrets(namespace, k8sConfig) {
    return await this.k8sRequest(`/api/v1/namespaces/${namespace}/secrets?fieldSelector=type=kubernetes.io/tls`, k8sConfig);
  }

  parseCertificate(certData, secret, config) {
    const tempFile = `/tmp/k8s_cert_${Date.now()}.pem`;
    
    try {
      fs.writeFileSync(tempFile, certData);
      
      const { execSync } = require('child_process');
      const output = execSync(`openssl x509 -in "${tempFile}" -text -noout`, { encoding: 'utf8' });
      
      const subjectMatch = output.match(/Subject: (.+)/);
      const issuerMatch = output.match(/Issuer: (.+)/);
      const notBeforeMatch = output.match(/Not Before: (.+)/);
      const notAfterMatch = output.match(/Not After : (.+)/);
      const serialMatch = output.match(/Serial Number:\s*([a-f0-9:]+)/i);
      const sanMatch = output.match(/DNS:([^,\s]+)/g);
      
      const subject = subjectMatch ? subjectMatch[1] : '';
      const cnMatch = subject.match(/CN\s*=\s*([^,]+)/);
      const domain = cnMatch ? cnMatch[1].trim() : secret.metadata.name;
      
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
          k8s_secret: secret.metadata.name,
          k8s_namespace: secret.metadata.namespace
        }
      });
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }
}

module.exports = K8sSecretsPlugin;