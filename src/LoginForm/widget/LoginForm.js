/*jslint browser: true, devel:true, nomen:true, unparam:true, plusplus: true, regexp: true*/
/*global logger, mendix, define, mx, dojo*/
/**
 LoginForm
 ========================
 @file      : LoginForm.js
 @version   : 3.5.0
 @author    : Mendix
 @date      : 7/26/2016
 @copyright : Mendix B.V.
 @license   : Apache 2.0
 Documentation
 ========================
 A custom login form which can be used as an alternative to the default Mendix login page.
 */
define([

    "mxui/widget/_WidgetBase", "dijit/_TemplatedMixin", "mxui/dom",
    "LoginForm/lib/jquery",
    "dojo/dom", "dojo/query", "dojo/dom-class",
    "dojo/dom-construct", "dojo/dom-style", "dojo/on",
    "dojo/_base/lang", "dojo/_base/declare", "dojo/text",
    "dojo/dom-attr", "dojo/request/xhr", "dojo/json",
    "dojo/_base/event", "dojo/html", "dojo/has",
    "dojo/text!LoginForm/widget/templates/LoginForm.html", "dojo/sniff"

], function (_WidgetBase, _TemplatedMixin, dom,
    _jQuery,
    dojoDom, dojoQuery, domClass,
    domConstruct, domStyle, dojoOn,
    dojoLang, declare, text,
    domAttr, dojoXhr, dojoJSON,
    dojoEvent, dojoHtml, dojoHas,
    template) {
    "use strict";
    // Declare widget.
    var $ = _jQuery.noConflict(true);
    return declare("LoginForm.widget.LoginForm", [_WidgetBase, _TemplatedMixin], {

        // Template path, set in the postMixInProperties function
        templateString: "",

        // DOM Elements
        loginFormNode: null,
        alertMessageNode: null,
        usernameInputNode: null,
        passwordContainerNode: null,
        passwordInputNode: null,
        passwordVisibilityToggleButtonNode: null,
        submitButtonNode: null,
        smsInputNode: null,
        recaptchaKey: null,
        usernameLabelNode: null,
        passwordLabelNode: null,
        LoginButtonContainerNode: null,


        // Recaptcha Token items
        mfCheckToken: null,
        responseTokenAttribute: null,


        // Parameters configured in the Modeler.
        /**
         * Display
         */
        userexample: "Username",
        passexample: "Password",
        logintext: "Login",
        progresstext: "",
        emptytext: "No username or password given",
        codetext: "Sms code",
        loginfailtext: null,
        resendtext: "Code opnieuw verstuurd",

        /**
         * Behaviour
         */
        showprogress: false,
        dofocus: false,
        /**
         * Password
         */
        showPasswordView: true,
        showButtonCaption: "Show",
        hideButtonCaption: "Mask",
        showImage: "",
        hideImage: "",
        /**
         * Mobile
         */
        autoCorrect: false,
        autoCapitalize: false,
        keyboardType: "text",

        // Internal variables. Non-primitives created in the prototype are shared between all widget instances.
        _handle: null,
        _userInput: null,
        _passInput: null,
        _context: null,
        _widgetId: null,
        _captionShow: "",
        _captionHide: "",
        _indicator: null,
        _i18nmap: null,
        _setup: false,
        _startTime: null,
        _logineventbusy: false,
        _loginForm_FailedAttempts: 0,
        // dijit._WidgetBase.postMixInProperties is called before rendering occurs, and before any dom nodes are created.
        postMixInProperties: function () {
            logger.debug(this.id + ".postMixInProperties");
            this.templateString = template;
        },
        // dijit._WidgetBase.postCreate is called after constructing the widget. Implement to do extra setup work
        constructor: function () {
            this._handles = [];
            if (typeof window._grecaptcha_widgets === "undefined") {
                window._grecaptcha_widgets = [];
            }
        },

        postCreate: function () {
            logger.debug(this.id + ".postCreate");
            this._getI18NMap();
            this._updateRendering();
            this._addRecaptcha();
            this._setupEvents();
        },

        update: function (object, callback) {
            this._context = object;
            callback();
        },
        // Rerender the interface.
        _updateRendering: function () {
            logger.debug(this.id + "._updateRendering");
            domClass.add(this.alertMessageNode, "hidden");
            this._addMobileOptions();
            this._setUsernameInputAttributes();

            // Captures focus for the input node. (Already automatically set, so can only if not done automatically)
            if (this.dofocus) {
                this._focusNode();
            }
        },
        /**
         * Conditionally sets the icon and caption of the show-password button
         * @private
         */
        _styleShowPasswordButton: function () {
            if (this.showImage) {
                this._captionShow = "<img src=\"" + this.showImage + "\" />";
            }

            if (this.showButtonCaption.trim() !== "") {
                this._captionShow += "<span>" + this.showButtonCaption + "</span>";
            }
        },
        /**
         * Conditionally sets the icon and caption of the mask-password button
         * @private
         */
        _styleMaskPasswordButton: function () {
            if (this.hideImage) {
                this._captionHide = "<img src=\"" + this.hideImage + "\" />";
            }

            if (this.hideButtonCaption.trim() !== "") {
                this._captionHide += "<span>" + this.hideButtonCaption + "</span>";
            }
        },
        /**
         * Conditionally sets the Username node input attributes
         * e.g autocorrect, autocapitalize, text-transform
         * @private
         */
        _setUsernameInputAttributes: function () {
            if (this.autoCorrect) {
                domAttr.set(this.usernameInputNode, "autocorrect", "on");
            }
        },
        /**
         * Controls what happens when Login Fails based on the passed in response code
         * @param code
         * @private
         */
        _loginFailed: function () {
            logger.debug(this.id + "._loginFailed");

            if (this._indicator) {
                mx.ui.hideProgress(this._indicator);
            }
            logger.warn("Login has failed");
            dojoHtml.set(this.alertMessageNode, this.loginfailtext);
            domClass.remove(this.alertMessageNode, "hidden");
            //reset recaptcha
            if (this._widgetId !== null) {
                this._widgetId = grecaptcha.reset(this._widgetId);
            }
            this._logineventbusy = false;
            this.passwordInputNode.disabled = false;
            this.usernameInputNode.disabled = false;
        },
        /**
         * Retrieves the matching value from the internationalization object
         * @param str
         * @returns {*}
         */
        translate: function (str) {
            return window.i18nMap[str];
        },

        // Attach events to HTML dom elements
        _setupEvents: function () {
            logger.debug(this.id + "._setupEvents");
            this.own(dojoOn(this.LoginButtonContainerNode, "click", dojoLang.hitch(this, this._prepareLogin)));

            this.own(dojoOn(this.passwordInputNode, "keydown", function (event) {
                if (event.keyCode === 13) {
                    document.getElementById("loginbutton").click();
                }
            }));
            this.own(dojoOn(this.smsInputNode, "keydown", function (event) {
                if (event.keyCode === 13) {
                    document.getElementById("loginbutton").click();
                }
            }));
            if (this.passwordVisibilityToggleButtonNode) {
                this.own(dojoOn(this.passwordVisibilityToggleButtonNode, "click", dojoLang.hitch(this, this.togglePasswordVisibility)));
            }
        },

        /**
         * Widget Interaction Methods.
         * ======================
         */

        /**
         * Attempts to login the user. Takes in an Event Parameter
         * @param e
         * @private
         */
        _loginUser: function (e) {
            logger.debug(this.id + "._loginUser");


            domClass.add(this.alertMessageNode, "hidden");

            if (domAttr.get(this.passwordInputNode, "type") === "text") {
                this.togglePasswordVisibility();
            }

            var username = this.usernameInputNode.value,
                password = this.passwordInputNode.value;

            if (username && password) {
                if (this.showprogress) {
                    logger.debug("Showing Progress!!");
                    this._indicator = mx.ui.showProgress();
                }

                mx.login(username, password, dojoLang.hitch(this, function (response) {
                    // Login Successful
                    if (this._indicator) {
                        mx.ui.hideProgress(this._indicator);
                    }
                }), dojoLang.hitch(this, this._loginFailed));

            } else {
                domClass.remove(this.alertMessageNode, "hidden");
                this.alertMessageNode.innerHTML = this.emptytext;
            }

            dojoEvent.stop(e);
        },
        /**
         * Show/hide the Password
         */
        togglePasswordVisibility: function () {
            if (domAttr.get(this.passwordInputNode, "type") === "password") {
                domAttr.set(this.passwordInputNode, "type", "text");
                dojoHtml.set(this.passwordVisibilityToggleButtonNode, this._captionHide);
            } else {
                domAttr.set(this.passwordInputNode, "type", "password");
                dojoHtml.set(this.passwordVisibilityToggleButtonNode, this._captionShow);
            }
        },
        /**
         * Retrieves internalization mapping
         * @private
         */
        _getI18NMap: function () {
            logger.debug(this.id + "._getI18NMap");
            if (!window.i18n) {
                dojoXhr(mx.appUrl + "js/login_i18n.js", {
                    handleAs: "javascript"
                }).then(dojoLang.hitch(this, function (data) {
                    this._i18nmap = window.i18nMap;
                }), dojoLang.hitch(this, function (err) {
                    logger.debug(this.id + "._getI18Map: Failed to get i18NMap!", err);
                }));
            }
        },
        /**
         * Sets focus to the username input node if not the default
         * @private
         */
        _focusNode: function () {
            logger.debug(this.id + "._focusNode");
            //Even with timeout set to 0, function code is made asynchronous
            setTimeout(dojoLang.hitch(this, this.usernameInputNode.focus()), 0);
        },
        /**
         * Detects if widget is running on mobile device and sets the available options e.g Keyboard Type
         * @private
         */
        _addMobileOptions: function () {
            if (dojoHas("ios") || dojoHas("android") || dojoHas("bb")) {
                domAttr.set(this.usernameInputNode, "type", this.keyboardType);
            }
        },

        _addRecaptcha: function () {
            this._recaptchaNode = domConstruct.create("div", {
                "id": this.id + "-recaptcha",
                "class": "recaptcha"
            });
            domConstruct.place(this._recaptchaNode, this.id);

            if (window.__google_recaptcha_client !== true && $("#google_recaptcha_script").length === 0) {
                try {
                    this._googleRecaptchaApiScript = domConstruct.create("script", {
                        "src": ("https:" === document.location.protocol ? "https" : "http") + "://www.google.com/recaptcha/api.js?render=explicit",
                        "id": "google_recaptcha_script",
                        "async": "true",
                        "defer": "true"
                    });
                    domConstruct.place(this._googleRecaptchaApiScript, dojoQuery("head")[0]);
                } catch (e) {
                    console.error("Failed to include Google Recaptcha script tag: " + e.message);
                }
            }
        },

        _renderRecaptcha: function () {
            if (this._widgetId !== null) {
                this._widgetId = grecaptcha.reset(this._widgetId);
            } else {
                this._startTime = new Date().getTime();
                if (typeof grecaptcha !== 'undefined') {
                    try {
                        this._widgetId = grecaptcha.render(this.id + "-recaptcha", {
                            'sitekey': this.recaptchaKey,
                            "callback": dojoLang.hitch(this, function (response) {
                                this._context.set(this.responseTokenAttribute, response);
                                // store response token in entity for server side validation
                                console.log(response);
                            })
                        });

                        window._grecaptcha_widgets.push(this._widgetId);
                    } catch (e) {
                        console.error("Failed to render recaptcha widget: " + e.message);
                    }
                } else {
                    var duration = new Date().getTime() - this._startTime;
                    if (duration > 15000) {
                        console.warn("Recaptcha widget " + this.id + " timeout, grecaptcha is undefined.");
                        return;
                    }
                    setTimeout(dojoLang.hitch(this, this._renderRecaptcha), 250);
                }
            }
        },


        // continue login
        _contLogin: function (reply) {
            if (reply === "ContLogin") {
                this._loginUser();
            } else if (reply === "SMS") {
                $('.smsContainer').removeClass('hidden');
                this.smsInputNode.focus();
                this.passwordInputNode.disabled = true;
                this.usernameInputNode.disabled = true;
                domClass.add(this.alertMessageNode, "hidden");
            } else if (reply === "Recaptcha") {
                this._renderRecaptcha();
            } else if (reply === "LoginFailed") {
                this._loginFailed();
            } else if (reply === "SMSResent") {
                dojoHtml.set(this.alertMessageNode, this.resendtext);
                $('.messagePane').removeClass('hidden');
                $('.smsContainer').removeClass('hidden');
                this.smsInputNode.focus();
                this.passwordInputNode.disabled = true;
                this.usernameInputNode.disabled = true;
            }
            this._logineventbusy = false;


        },

        uninitialize: function () {

            logger.debug(this.id + ".uninitialize");
            // Clean up listeners, helper objects, etc. There is no need to remove listeners added with this.connect / this.subscribe / this.own.
        },


        // prepare login
        _prepareLogin: function (e) {
            if (this._logineventbusy === true) {
                return;
            }
            domClass.remove(this.alertMessageNode, "hidden");
            this._logineventbusy = true;
            this._loginevent = this.passwordInputNode.events;
            this.passwordInputNode.events = null;

            var username = this.usernameInputNode.value,
                password = this.passwordInputNode.value,
                Inputsms = this.smsInputNode.value;


            this._context.set("UserName", username);
            this._context.set("PassWord", password);
            this._context.set("InputSMSCode", Inputsms);
            this._context.set("Url", window.location.hostname);
            mx.data.action({
                    params: {
                        applyto: 'selection',
                        actionname: this.mfCheckToken,
                        guids: [this._context.getGuid()]
                    },
                    callback: dojoLang.hitch(this, function (rep) {
                        dojoLang.hitch(this, this._contLogin(rep));
                    }),
                    error: dojoLang.hitch(this, function (error) {
                        this._loginFailed();
                    })
                },
                this);
        }
    });
});

require(["LoginForm/widget/LoginForm"]);