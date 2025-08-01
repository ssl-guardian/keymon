class BasePlugin {
  constructor() {
    this.name = 'base';
    this.description = 'Base plugin class';
    this.requiredParams = [];
  }

  // Override in child classes
  async collect(config) {
    throw new Error('collect() method must be implemented');
  }

  // Helper to validate required parameters
  validateConfig(config) {
    for (const param of this.requiredParams) {
      if (!config[param]) {
        throw new Error(`Required parameter '${param}' missing for ${this.name} plugin`);
      }
    }
  }

  // Helper to create certificate object
  createCertificate(data) {
    return {
      domain: data.domain,
      issuer: data.issuer || 'Unknown',
      expiration_date: data.expiration_date,
      valid_from: data.valid_from,
      subject: data.subject || data.domain,
      san: data.san || [data.domain],
      fingerprint: data.fingerprint,
      fingerprint256: data.fingerprint256,
      serial_number: data.serial_number,
      tags: {
        source: this.name,
        environment: data.environment,
        group: data.group,
        ...data.tags
      }
    };
  }
}

module.exports = BasePlugin;