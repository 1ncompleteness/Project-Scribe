const fs = require('fs');
const paths = require('react-scripts/config/paths');
const evalSourceMapMiddleware = require('react-dev-utils/evalSourceMapMiddleware');
const noopServiceWorkerMiddleware = require('react-dev-utils/noopServiceWorkerMiddleware');
const redirectServedPath = require('react-dev-utils/redirectServedPathMiddleware');

module.exports = function override(config, env) {
  // Return the modified config
  return config;
};

module.exports.devServer = function(configFunction) {
  // Return a new function that wraps the original webpack dev server config function
  return function(proxy, allowedHost) {
    // Get the original config
    const config = configFunction(proxy, allowedHost);
    
    // Remove the deprecated options
    delete config.onBeforeSetupMiddleware;
    delete config.onAfterSetupMiddleware;
    
    // Add the new setupMiddlewares option
    config.setupMiddlewares = (middlewares, devServer) => {
      if (!devServer) {
        throw new Error('webpack-dev-server is not defined');
      }

      // Add the middleware that was previously in onBeforeSetupMiddleware
      devServer.app.use(evalSourceMapMiddleware(devServer));
      
      if (fs.existsSync(paths.proxySetup)) {
        // This registers user provided middleware for proxy reasons
        require(paths.proxySetup)(devServer.app);
      }
      
      // Add the middleware that was previously in onAfterSetupMiddleware
      middlewares.push(
        redirectServedPath(paths.publicUrlOrPath),
        noopServiceWorkerMiddleware(paths.publicUrlOrPath)
      );
      
      return middlewares;
    };
    
    return config;
  };
}; 