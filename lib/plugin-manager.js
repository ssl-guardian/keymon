const fs = require('fs');
const path = require('path');

class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.pluginDir = path.join(__dirname, '..', 'plugins');
  }

  loadPlugin(name) {
    if (this.plugins.has(name)) {
      return this.plugins.get(name);
    }

    const pluginPath = path.join(this.pluginDir, `${name}.js`);
    if (!fs.existsSync(pluginPath)) {
      throw new Error(`Plugin '${name}' not found at ${pluginPath}`);
    }

    const PluginClass = require(pluginPath);
    const plugin = new PluginClass();
    
    // Validate plugin interface
    if (!plugin.name || !plugin.collect || typeof plugin.collect !== 'function') {
      throw new Error(`Plugin '${name}' must have name and collect() method`);
    }

    this.plugins.set(name, plugin);
    return plugin;
  }

  async executePlugin(name, config) {
    const plugin = this.loadPlugin(name);
    return await plugin.collect(config);
  }

  listAvailablePlugins() {
    if (!fs.existsSync(this.pluginDir)) {
      return [];
    }
    
    return fs.readdirSync(this.pluginDir)
      .filter(file => file.endsWith('.js'))
      .map(file => file.replace('.js', ''));
  }
}

module.exports = PluginManager;