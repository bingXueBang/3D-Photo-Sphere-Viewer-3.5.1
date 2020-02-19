/**
 * @summary Starts to load the panorama
 * @returns {Promise}
 * @throws {PSVError} when the panorama is not configured
 * @deprecated Use {@link PhotoSphereViewer#setPanorama} instead
 */
PhotoSphereViewer.prototype.load = function() {
  if (!this.config.panorama) {
    throw new PSVError('No value given for panorama.');
  }

  return this.setPanorama(this.config.panorama, false);
};

/**
 * @summary Returns the current position of the camera
 * @returns {PhotoSphereViewer.Position}
 */
PhotoSphereViewer.prototype.getPosition = function() {
  return {
    longitude: this.prop.position.longitude,
    latitude: this.prop.position.latitude
  };
};

/**
 * @summary Returns the current zoom level
 * @returns {int}
 */
PhotoSphereViewer.prototype.getZoomLevel = function() {
  return this.prop.zoom_lvl;
};

/**
 * @summary Returns the current viewer size
 * @returns {PhotoSphereViewer.Size}
 */
PhotoSphereViewer.prototype.getSize = function() {
  return {
    width: this.prop.size.width,
    height: this.prop.size.height
  };
};

/**
 * @summary Checks if the automatic rotation is enabled
 * @returns {boolean}
 */
PhotoSphereViewer.prototype.isAutorotateEnabled = function() {
  return !!this.prop.autorotate_cb;
};

/**
 * @summary Checks if the gyroscope is enabled
 * @returns {boolean}
 */
PhotoSphereViewer.prototype.isGyroscopeEnabled = function() {
  return !!this.prop.orientation_cb;
};

/**
 * @summary Checks if the stereo viewx is enabled
 * @returns {boolean}
 */
PhotoSphereViewer.prototype.isStereoEnabled = function() {
  return !!this.stereoEffect;
};

/**
 * @summary Checks if the viewer is in fullscreen
 * @returns {boolean}
 */
PhotoSphereViewer.prototype.isFullscreenEnabled = function() {
  return PSVUtils.isFullscreenEnabled(this.container);
};

/**
 * @summary Flags the view has changed for the next render
 */
PhotoSphereViewer.prototype.needsUpdate = function() {
  this.prop.needsUpdate = true;
};

/**
 * @summary Performs a render
 * @deprecated Use {@link PhotoSphereViewer.event:before-render} instead
 */
PhotoSphereViewer.prototype.render = function() {
  this._render();
};

/**
 * @summary Destroys the viewer
 * @description The memory used by the ThreeJS context is not totally cleared. This will be fixed as soon as possible.
 */
PhotoSphereViewer.prototype.destroy = function() {
  window.cancelAnimationFrame(this.prop.main_reqid);

  this._stopAll();
  this.stopKeyboardControl();
  this.stopNoSleep();
  this.exitFullscreen();
  this.unlockOrientation();

  // remove listeners
  this._unbindEvents();

  // destroy components
  if (this.tooltip) {
    this.tooltip.destroy();
  }
  if (this.notification) {
    this.notification.destroy();
  }
  if (this.hud) {
    this.hud.destroy();
  }
  if (this.loader) {
    this.loader.destroy();
  }
  if (this.navbar) {
    this.navbar.destroy();
  }
  if (this.panel) {
    this.panel.destroy();
  }
  if (this.overlay) {
    this.overlay.destroy();
  }

  // destroy ThreeJS view
  if (this.scene) {
    PSVUtils.cleanTHREEScene(this.scene);
  }

  // remove container
  if (this.canvas_container) {
    this.container.removeChild(this.canvas_container);
  }
  this.parent.removeChild(this.container);

  delete this.parent.photoSphereViewer;

  // clean references
  delete this.parent;
  delete this.container;
  delete this.loader;
  delete this.navbar;
  delete this.hud;
  delete this.panel;
  delete this.tooltip;
  delete this.notification;
  delete this.overlay;
  delete this.canvas_container;
  delete this.renderer;
  delete this.noSleep;
  delete this.scene;
  delete this.camera;
  delete this.mesh;
  delete this.raycaster;
  delete this.passes;
  delete this.config;
  this.prop.cache.length = 0;
};

/**
 * @summary Loads a new panorama file
 * @description Loads a new panorama file, optionally changing the camera position and activating the transition animation.<br>
 * If the "position" is not defined, the camera will not move and the ongoing animation will continue<br>
 * "config.transition" must be configured for "transition" to be taken in account
 * @param {string|string[]} path - URL of the new panorama file
 * @param {PhotoSphereViewer.PanoramaOptions} [options]
 * @param {boolean} [transition=false]
 * @returns {Promise}
 * @throws {PSVError} when another panorama is already loading
 */
PhotoSphereViewer.prototype.setPanorama = function(path, options, transition) {
  if (this.prop.loading_promise !== null) {
    throw new PSVError('Loading already in progress');
  }

  if (typeof options === 'boolean') {
    transition = options;
    options = undefined;
  }
  if (!options && !this.scene) {
    options = {
      longitude: this.config.default_long,
      latitude: this.config.default_lat,
      zoom: this.config.default_zoom_lvl,
      sphere_correction: this.config.sphere_correction
    };
  }
  else if (!options) {
    options = {};
  }

  var positionProvided = this.isExtendedPosition(options);
  var zoomProvided = 'zoom' in options;

  if (positionProvided || zoomProvided) {
    this._stopAll();
  }

  this.config.panorama = path;

  var done = function() {
    this.loader.hide();
    this.canvas_container.style.opacity = 1;

    this.prop.loading_promise = null;
  }.bind(this);

  if (!transition || !this.config.transition || !this.scene) {
    this.loader.show();
    if (this.canvas_container) {
      this.canvas_container.style.opacity = 0;
    }

    this.prop.loading_promise = this._loadTexture(this.config.panorama)
      .then(function(texture) {
        this._setTexture(texture);

        if (options.sphere_correction && !this.prop.isCubemap) {
          this._setSphereCorrection(this.mesh, options.sphere_correction);
        }

        if (positionProvided) {
          this.rotate(options);
        }
        if (zoomProvided) {
          this.zoom(options.zoom);
        }
      }.bind(this))
      .then(done, done);
  }
  else {
    if (this.config.transition.loader) {
      this.loader.show();
    }

    this.prop.loading_promise = this._loadTexture(this.config.panorama)
      .then(function(texture) {
        this.loader.hide();

        return this._transition(texture, options);
      }.bind(this))
      .then(done, done);
  }

  return this.prop.loading_promise;
};

/**
 * @summary Starts the automatic rotation
 * @fires PhotoSphereViewer.autorotate
 */
PhotoSphereViewer.prototype.startAutorotate = function() {
  this._stopAll();

  this.prop.autorotate_cb = this._getAutorotateUpdate();
  this.on('before-render', this.prop.autorotate_cb);

  /**
   * @event autorotate
   * @memberof PhotoSphereViewer
   * @summary Triggered when the automatic rotation is enabled/disabled
   * @param {boolean} enabled
   */
  this.trigger('autorotate', true);
};

/**
 * @summary Create an animation callback for the automatic rotation
 * @returns {function}
 * @private
 */
PhotoSphereViewer.prototype._getAutorotateUpdate = function() {
  var last;
  var elapsed;

  return function(timestamp) {
    elapsed = last === undefined ? 0 : timestamp - last;
    last = timestamp;

    this.rotate({
      longitude: this.prop.position.longitude + this.config.anim_speed * elapsed / 1000,
      latitude: this.prop.position.latitude - (this.prop.position.latitude - this.config.anim_lat) / 200
    });
  };
};

/**
 * @summary Stops the automatic rotation
 * @fires PhotoSphereViewer.autorotate
 */
PhotoSphereViewer.prototype.stopAutorotate = function() {
  if (this.prop.start_timeout) {
    window.clearTimeout(this.prop.start_timeout);
    this.prop.start_timeout = null;
  }

  if (this.isAutorotateEnabled()) {
    this.off('before-render', this.prop.autorotate_cb);
    this.prop.autorotate_cb = null;

    this.trigger('autorotate', false);
  }
};

/**
 * @summary Starts or stops the automatic rotation
 */
PhotoSphereViewer.prototype.toggleAutorotate = function() {
  if (this.isAutorotateEnabled()) {
    this.stopAutorotate();
  }
  else {
    this.startAutorotate();
  }
};

/**
 * @summary Enables the gyroscope navigation if available
 * @fires PhotoSphereViewer.gyroscope-updated
 * @throws {PSVError} if DeviceOrientationControls.js is missing
 */
PhotoSphereViewer.prototype.startGyroscopeControl = function() {
  if (PSVUtils.checkTHREE('DeviceOrientationControls')) {
    return PhotoSphereViewer.SYSTEM.deviceOrientationSupported.then(function(supported) {
      if (supported) {
        this._stopAll();

        this.doControls = new THREE.DeviceOrientationControls(this.camera);

        // compute the alpha offset to keep the current orientation
        this.doControls.alphaOffset = this.prop.position.longitude;
        this.doControls.update();

        var direction = this.camera.getWorldDirection(new THREE.Vector3());
        var sphericalCoords = this.vector3ToSphericalCoords(direction);

        this.prop.gyro_alpha_offset = sphericalCoords.longitude;

        this.prop.orientation_cb = this._getOrientationUpdate();
        this.on('before-render', this.prop.orientation_cb);

        /**
         * @event gyroscope-updated
         * @memberof PhotoSphereViewer
         * @summary Triggered when the gyroscope mode is enabled/disabled
         * @param {boolean} enabled
         */
        this.trigger('gyroscope-updated', true);
      }
      else {
        console.warn('PhotoSphereViewer: gyroscope not available');
        return Promise.reject();
      }
    }.bind(this));
  }
  else {
    throw new PSVError('Missing Three.js components: DeviceOrientationControls. Get them from three.js-examples package.');
  }
};

/**
 * @summary Create an animation callback for the orientation controls
 * @returns {function}
 * @private
 */
PhotoSphereViewer.prototype._getOrientationUpdate = function() {
  return function() {
    this.doControls.alphaOffset = this.prop.gyro_alpha_offset;
    this.doControls.update();

    this.camera.getWorldDirection(this.prop.direction);
    this.prop.direction.multiplyScalar(PhotoSphereViewer.SPHERE_RADIUS);

    var sphericalCoords = this.vector3ToSphericalCoords(this.prop.direction);
    this.prop.position.longitude = sphericalCoords.longitude;
    this.prop.position.latitude = sphericalCoords.latitude;
    this.needsUpdate();
  };
};

/**
 * @summary Disables the gyroscope navigation
 * @fires PhotoSphereViewer.gyroscope-updated
 */
PhotoSphereViewer.prototype.stopGyroscopeControl = function() {
  if (this.isGyroscopeEnabled()) {
    this.off('before-render', this.prop.orientation_cb);
    this.prop.orientation_cb = null;

    this.doControls.disconnect();
    this.doControls = null;

    this.trigger('gyroscope-updated', false);
  }
};

/**
 * @summary Enables or disables the gyroscope navigation
 */
PhotoSphereViewer.prototype.toggleGyroscopeControl = function() {
  if (this.isGyroscopeEnabled()) {
    this.stopGyroscopeControl();
  }
  else {
    this.startGyroscopeControl();
  }
};

/**
 * @summary Enables NoSleep.js
 */
PhotoSphereViewer.prototype.startNoSleep = function() {
  if (!('NoSleep' in window)) {
    console.warn('PhotoSphereViewer: NoSleep is not available');
    return;
  }

  if (!this.noSleep) {
    this.noSleep = new NoSleep();
  }

  this.noSleep.enable();
};

/**
 * @summary Disables NoSleep.js
 */
PhotoSphereViewer.prototype.stopNoSleep = function() {
  if (this.noSleep) {
    this.noSleep.disable();
  }
};

/**
 * @summary Enables the stereo view
 * @description
 *  - enables NoSleep.js
 *  - enables full screen
 *  - starts gyroscope controle
 *  - hides hud, navbar and panel
 *  - instanciate StereoEffect
 * @throws {PSVError} if StereoEffect.js is not available
 */
PhotoSphereViewer.prototype.startStereoView = function() {
  if (PSVUtils.checkTHREE('DeviceOrientationControls', 'StereoEffect')) {
    // Need to be in the main event queue
    this.startNoSleep();
    this.enterFullscreen();
    this.lockOrientation();

    this.startGyroscopeControl().then(
      function() {
        this.stereoEffect = new THREE.StereoEffect(this.renderer);
        this.needsUpdate();

        this.hud.hide();
        this.navbar.hide();
        this.panel.hidePanel();

        /**
         * @event stereo-updated
         * @memberof PhotoSphereViewer
         * @summary Triggered when the stereo view is enabled/disabled
         * @param {boolean} enabled
         */
        this.trigger('stereo-updated', true);

        this.notification.showNotification({
          content: this.config.lang.stereo_notification,
          timeout: 3000
        });
      }.bind(this),
      function() {
        this.unlockOrientation();
        this.exitFullscreen();
        this.stopNoSleep();
      }.bind(this)
    );
  }
  else {
    throw new PSVError('Missing Three.js components: StereoEffect, DeviceOrientationControls. Get them from three.js-examples package.');
  }
};

/**
 * @summary Disables the stereo view
 */
PhotoSphereViewer.prototype.stopStereoView = function() {
  if (this.isStereoEnabled()) {
    this.stereoEffect = null;
    this.needsUpdate();

    this.hud.show();
    this.navbar.show();

    this.unlockOrientation();
    this.exitFullscreen();
    this.stopNoSleep();
    this.stopGyroscopeControl();

    this.trigger('stereo-updated', false);
  }
};

/**
 * @summary Tries to lock the device in landscape or display a message
 */
PhotoSphereViewer.prototype.lockOrientation = function() {
  var displayRotateMessageTimeout;

  var displayRotateMessage = function() {
    if (this.isStereoEnabled() && window.innerHeight > window.innerWidth) {
      this.overlay.showOverlay({
        image: PhotoSphereViewer.ICONS['mobile-rotate.svg'],
        text: this.config.lang.please_rotate[0],
        subtext: this.config.lang.please_rotate[1]
      });
    }

    if (displayRotateMessageTimeout) {
      window.clearTimeout(displayRotateMessageTimeout);
    }
  };

  if (window.screen && window.screen.orientation) {
    window.screen.orientation.lock('landscape').then(null, displayRotateMessage.bind(this));
    displayRotateMessageTimeout = setTimeout(displayRotateMessage.bind(this), 500);
  }
  else {
    displayRotateMessage.apply(this);
  }
};

/**
 * @summary Unlock the device orientation
 */
PhotoSphereViewer.prototype.unlockOrientation = function() {
  if (window.screen && window.screen.orientation) {
    window.screen.orientation.unlock();
  }
  else {
    this.overlay.hideOverlay();
  }
};

/**
 * @summary Enables or disables the stereo view
 */
PhotoSphereViewer.prototype.toggleStereoView = function() {
  if (this.isStereoEnabled()) {
    this.stopStereoView();
  }
  else {
    this.startStereoView();
  }
};

/**
 * @summary Rotates the view to specific longitude and latitude
 * @param {PhotoSphereViewer.ExtendedPosition} position
 * @param {boolean} [ignoreRange=false] - ignore longitude_range and latitude_range
 * @fires PhotoSphereViewer._side-reached
 * @fires PhotoSphereViewer.position-updated
 */
PhotoSphereViewer.prototype.rotate = function(position, ignoreRange) {
  this.cleanPosition(position);

  if (!ignoreRange) {
    /**
     * @event _side-reached
     * @memberof PhotoSphereViewer
     * @param {string} side
     * @private
     */
    this.applyRanges(position).forEach(
      this.trigger.bind(this, '_side-reached')
    );
  }

  this.prop.position.longitude = position.longitude;
  this.prop.position.latitude = position.latitude;
  this.needsUpdate();

  /**
   * @event position-updated
   * @memberof PhotoSphereViewer
   * @summary Triggered when the view longitude and/or latitude changes
   * @param {PhotoSphereViewer.Position} position
   */
  this.trigger('position-updated', this.getPosition());
};

/**
 * @summary Rotates the view to specific longitude and latitude with a smooth animation
 * @param {PhotoSphereViewer.AnimateOptions} options
 * @param {string|int} [speed] - animation speed or duration (in milliseconds)
 * @returns {PSVAnimation}
 */
PhotoSphereViewer.prototype.animate = function(options, speed) {
  this._stopAll();

  var positionProvided = this.isExtendedPosition(options);
  var zoomProvided = 'zoom' in options;

  var animProperties = {};
  var duration;

  // clean/filter position and compute duration
  if (positionProvided) {
    this.cleanPosition(options);
    this.applyRanges(options);

    var currentPosition = this.prop.position;
    var dLongitude = Math.abs(options.longitude - currentPosition.longitude);
    var dLatitude = Math.abs(options.latitude - currentPosition.latitude);

    if (dLongitude >= PhotoSphereViewer.ANGLE_THRESHOLD || dLatitude >= PhotoSphereViewer.ANGLE_THRESHOLD) {
      // longitude offset for shortest arc
      var tOffset = PSVUtils.getShortestArc(this.prop.position.longitude, options.longitude);

      animProperties.longitude = { start: currentPosition.longitude, end: currentPosition.longitude + tOffset };
      animProperties.latitude = { start: currentPosition.latitude, end: options.latitude };

      duration = this.speedToDuration(speed, PSVUtils.getAngle(currentPosition, options));
    }
  }

  // clean/filter zoom and compute duration
  if (zoomProvided) {
    var dZoom = Math.abs(options.zoom - this.prop.zoom_lvl);

    if (dZoom >= 1) {
      animProperties.zoom = { start: this.prop.zoom_lvl, end: options.zoom };

      if (!duration) {
        // if animating zoom only and a speed is given, use an arbitrary PI/2 to compute the duration
        duration = this.speedToDuration(speed, Math.PI / 4 * dZoom / 100);
      }
    }
  }

  // if no animation needed
  if (!duration) {
    if (positionProvided) {
      this.rotate(options);
    }
    if (zoomProvided) {
      this.zoom(options.zoom);
    }

    return PSVAnimation.resolve();
  }

  this.prop.animation_promise = new PSVAnimation({
    properties: animProperties,
    duration: duration,
    easing: 'inOutSine',
    onTick: function(properties) {
      if (positionProvided) {
        this.rotate(properties, true);
      }
      if (zoomProvided) {
        this.zoom(properties.zoom);
      }
    }.bind(this)
  });

  return this.prop.animation_promise;
};

/**
 * @summary Stops the ongoing animation
 * @description The return value is a Promise because the is no guaranty the animation can be stopped synchronously.
 * @returns {Promise} Resolved when the animation has ben cancelled
 */
PhotoSphereViewer.prototype.stopAnimation = function() {
  if (this.prop.animation_promise) {
    return new Promise(function(resolve) {
      this.prop.animation_promise.finally(resolve);
      this.prop.animation_promise.cancel();
      this.prop.animation_promise = null;
    }.bind(this));
  }
  else {
    return Promise.resolve();
  }
};

/**
 * @summary Zooms to a specific level between `max_fov` and `min_fov`
 * @param {int} level - new zoom level from 0 to 100
 * @fires PhotoSphereViewer.zoom-updated
 */
PhotoSphereViewer.prototype.zoom = function(level) {
  this.prop.zoom_lvl = PSVUtils.bound(level, 0, 100);
  this.prop.vFov = this.config.max_fov + (this.prop.zoom_lvl / 100) * (this.config.min_fov - this.config.max_fov);
  this.prop.hFov = THREE.Math.radToDeg(2 * Math.atan(Math.tan(THREE.Math.degToRad(this.prop.vFov) / 2) * this.prop.aspect));
  this.needsUpdate();

  /**
   * @event zoom-updated
   * @memberof PhotoSphereViewer
   * @summary Triggered when the zoom level changes
   * @param {int} zoomLevel
   */
  this.trigger('zoom-updated', this.getZoomLevel());
};

/**
 * @summary Increases the zoom level by 1
 */
PhotoSphereViewer.prototype.zoomIn = function() {
  if (this.prop.zoom_lvl < 100) {
    this.zoom(this.prop.zoom_lvl + this.config.zoom_speed);
  }
};

/**
 * @summary Decreases the zoom level by 1
 */
PhotoSphereViewer.prototype.zoomOut = function() {
  if (this.prop.zoom_lvl > 0) {
    this.zoom(this.prop.zoom_lvl - this.config.zoom_speed);
  }
};

/**
 * @summary Resizes the viewer
 * @param {PhotoSphereViewer.CssSize} size
 */
PhotoSphereViewer.prototype.resize = function(size) {
  if (size.width) {
    this.container.style.width = size.width;
  }
  if (size.height) {
    this.container.style.height = size.height;
  }

  this._onResize();
};

PhotoSphereViewer.prototype.enterFullscreen = function() {
  PSVUtils.requestFullscreen(this.container);
};

PhotoSphereViewer.prototype.exitFullscreen = function() {
  if (this.isFullscreenEnabled()) {
    PSVUtils.exitFullscreen();
  }
};

/**
 * @summary Enters or exits the fullscreen mode
 */
PhotoSphereViewer.prototype.toggleFullscreen = function() {
  if (!this.isFullscreenEnabled()) {
    this.enterFullscreen();
  }
  else {
    this.exitFullscreen();
  }
};

/**
 * @summary Enables the keyboard controls (done automatically when entering fullscreen)
 */
PhotoSphereViewer.prototype.startKeyboardControl = function() {
  window.addEventListener('keydown', this);
};

/**
 * @summary Disables the keyboard controls (done automatically when exiting fullscreen)
 */
PhotoSphereViewer.prototype.stopKeyboardControl = function() {
  window.removeEventListener('keydown', this);
};

/**
 * @summary Preload a panorama file without displaying it
 * @param {string} panorama
 * @returns {Promise}
 * @throws {PSVError} when the cache is disabled
 */
PhotoSphereViewer.prototype.preloadPanorama = function(panorama) {
  if (!this.config.cache_texture) {
    throw new PSVError('Cannot preload panorama, cache_texture is disabled');
  }

  return this._loadTexture(panorama);
};

/**
 * @summary Removes a panorama from the cache or clears the entire cache
 * @param {string} [panorama]
 * @throws {PSVError} when the cache is disabled
 */
PhotoSphereViewer.prototype.clearPanoramaCache = function(panorama) {
  if (!this.config.cache_texture) {
    throw new PSVError('Cannot clear cache, cache_texture is disabled');
  }

  if (panorama) {
    for (var i = 0, l = this.prop.cache.length; i < l; i++) {
      if (this.prop.cache[i].panorama === panorama) {
        this.prop.cache.splice(i, 1);
        break;
      }
    }
  }
  else {
    this.prop.cache.length = 0;
  }
};

/**
 * @summary Retrieves the cache for a panorama
 * @param {string} panorama
 * @returns {PhotoSphereViewer.CacheItem}
 * @throws {PSVError} when the cache is disabled
 */
PhotoSphereViewer.prototype.getPanoramaCache = function(panorama) {
  if (!this.config.cache_texture) {
    throw new PSVError('Cannot query cache, cache_texture is disabled');
  }

  return this.prop.cache.filter(function(cache) {
    return cache.panorama === panorama;
  }).shift();
};
