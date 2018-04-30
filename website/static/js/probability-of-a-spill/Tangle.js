//
//  Tangle.js
//  Tangle 0.1.0
//
//  Created by Bret Victor on 5/2/10.
//  (c) 2011 Bret Victor.  MIT open-source license.
//
//  ------ model ------
//
//  var tangle = new Tangle(rootElement, model);
//  tangle.setModel(model);
//
//  ------ variables ------
//
//  var value = tangle.getValue(variableName);
//  tangle.setValue(variableName, value);
//  tangle.setValues({ variableName:value, variableName:value });
//
//  ------ UI components ------
//
//  Tangle.classes.myClass = {
//     initialize: function (element, options, tangle, variable) { ... },
//     update: function (element, value) { ... }
//  };
//  Tangle.formats.myFormat = function (value) { return "..."; };
//

var Tangle = this.Tangle = function (rootElement, modelClass) {

    var tangle = this;
    tangle.element = rootElement;
    tangle.setModel = setModel;
    tangle.getValue = getValue;
    tangle.setValue = setValue;
    tangle.setValues = setValues;

    var _model;
    var _nextSetterID = 0;
    var _setterInfosByVariableName = {};   //  { varName: { setterID:7, setter:function (v) { } }, ... }
    var _varargConstructorsByArgCount = [];


    //----------------------------------------------------------
    //
    // construct

    initializeElements();
    setModel(modelClass);
    return tangle;


    //----------------------------------------------------------
    //
    // elements

    function initializeElements() {
        var elements = rootElement.getElementsByTagName("*");
        var interestingElements = [];

        // build a list of elements with class or data-var attributes

        for (var i = 0, length = elements.length; i < length; i++) {
            var element = elements[i];
            if (element.getAttribute("class") || element.getAttribute("data-var")) {
                interestingElements.push(element);
            }
        }

        // initialize interesting elements in this list.  (Can't traverse "elements"
        // directly, because elements is "live", and views that change the node tree
        // will change elements mid-traversal.)

        for (var i = 0, length = interestingElements.length; i < length; i++) {
            var element = interestingElements[i];

            var varNames = null;
            var varAttribute = element.getAttribute("data-var");
            if (varAttribute) { varNames = varAttribute.split(" "); }

            var views = null;
            var classAttribute = element.getAttribute("class");
            if (classAttribute) {
                var classNames = classAttribute.split(" ");
                views = getViewsForElement(element, classNames, varNames);
            }

            if (!varNames) { continue; }

            var didAddSetter = false;
            if (views) {
                for (var j = 0; j < views.length; j++) {
                    if (!views[j].update) { continue; }
                    addViewSettersForElement(element, varNames, views[j]);
                    didAddSetter = true;
                }
            }

            if (!didAddSetter) {
                var formatAttribute = element.getAttribute("data-format");
                var formatter = getFormatterForFormat(formatAttribute, varNames);
                addFormatSettersForElement(element, varNames, formatter);
            }
        }
    }

    function getViewsForElement(element, classNames, varNames) {   // initialize classes
        var views = null;

        for (var i = 0, length = classNames.length; i < length; i++) {
            var clas = Tangle.classes[classNames[i]];
            if (!clas) { continue; }

            var options = getOptionsForElement(element);
            var args = [ element, options, tangle ];
            if (varNames) { args = args.concat(varNames); }

            var view = constructClass(clas, args);

            if (!views) { views = []; }
            views.push(view);
        }

        return views;
    }

    function getOptionsForElement(element) {   // might use dataset someday
        var options = {};

        var attributes = element.attributes;
        var regexp = /^data-[\w\-]+$/;

        for (var i = 0, length = attributes.length; i < length; i++) {
            var attr = attributes[i];
            var attrName = attr.name;
            if (!attrName || !regexp.test(attrName)) { continue; }

            options[attrName.substr(5)] = attr.value;
        }

        return options;
    }

    function constructClass(clas, args) {
        if (typeof clas !== "function") {  // class is prototype object
            var View = function () { };
            View.prototype = clas;
            var view = new View();
            if (view.initialize) { view.initialize.apply(view,args); }
            return view;
        }
        else {  // class is constructor function, which we need to "new" with varargs (but no built-in way to do so)
            var ctor = _varargConstructorsByArgCount[args.length];
            if (!ctor) {
                var ctorArgs = [];
                for (var i = 0; i < args.length; i++) { ctorArgs.push("args[" + i + "]"); }
                var ctorString = "(function (clas,args) { return new clas(" + ctorArgs.join(",") + "); })";
                ctor = eval(ctorString);   // nasty
                _varargConstructorsByArgCount[args.length] = ctor;   // but cached
            }
            return ctor(clas,args);
        }
    }


    //----------------------------------------------------------
    //
    // formatters

    function getFormatterForFormat(formatAttribute, varNames) {
        if (!formatAttribute) { formatAttribute = "default"; }

        var formatter = getFormatterForCustomFormat(formatAttribute, varNames);
        if (!formatter) { formatter = getFormatterForSprintfFormat(formatAttribute, varNames); }
        if (!formatter) { log("Tangle: unknown format: " + formatAttribute); formatter = getFormatterForFormat(null,varNames); }

        return formatter;
    }

    function getFormatterForCustomFormat(formatAttribute, varNames) {
        var components = formatAttribute.split(" ");
        var formatName = components[0];
        if (!formatName) { return null; }

        var format = Tangle.formats[formatName];
        if (!format) { return null; }

        var formatter;
        var params = components.slice(1);

        if (varNames.length <= 1 && params.length === 0) {  // one variable, no params
            formatter = format;
        }
        else if (varNames.length <= 1) {  // one variable with params
            formatter = function (value) {
                var args = [ value ].concat(params);
                return format.apply(null, args);
            };
        }
        else {  // multiple variables
            formatter = function () {
                var values = getValuesForVariables(varNames);
                var args = values.concat(params);
                return format.apply(null, args);
            };
        }
        return formatter;
    }

    function getFormatterForSprintfFormat(formatAttribute, varNames) {
        if (!sprintf || !formatAttribute.test(/\%/)) { return null; }

        var formatter;
        if (varNames.length <= 1) {  // one variable
            formatter = function (value) {
                return sprintf(formatAttribute, value);
            };
        }
        else {
            formatter = function (value) {  // multiple variables
                var values = getValuesForVariables(varNames);
                var args = [ formatAttribute ].concat(values);
                return sprintf.apply(null, args);
            };
        }
        return formatter;
    }


    //----------------------------------------------------------
    //
    // setters

    function addViewSettersForElement(element, varNames, view) {   // element has a class with an update method
        var setter;
        if (varNames.length <= 1) {
            setter = function (value) { view.update(element, value); };
        }
        else {
            setter = function () {
                var values = getValuesForVariables(varNames);
                var args = [ element ].concat(values);
                view.update.apply(view,args);
            };
        }

        addSetterForVariables(setter, varNames);
    }

    function addFormatSettersForElement(element, varNames, formatter) {  // tangle is injecting a formatted value itself
        var span = null;
        var setter = function (value) {
            if (!span) {
                span = document.createElement("span");
                element.insertBefore(span, element.firstChild);
            }
            span.innerHTML = formatter(value);
        };

        addSetterForVariables(setter, varNames);
    }

    function addSetterForVariables(setter, varNames) {
        var setterInfo = { setterID:_nextSetterID, setter:setter };
        _nextSetterID++;

        for (var i = 0; i < varNames.length; i++) {
            var varName = varNames[i];
            if (!_setterInfosByVariableName[varName]) { _setterInfosByVariableName[varName] = []; }
            _setterInfosByVariableName[varName].push(setterInfo);
        }
    }

    function applySettersForVariables(varNames) {
        var appliedSetterIDs = {};  // remember setterIDs that we've applied, so we don't call setters twice

        for (var i = 0, ilength = varNames.length; i < ilength; i++) {
            var varName = varNames[i];
            var setterInfos = _setterInfosByVariableName[varName];
            if (!setterInfos) { continue; }

            var value = _model[varName];

            for (var j = 0, jlength = setterInfos.length; j < jlength; j++) {
                var setterInfo = setterInfos[j];
                if (setterInfo.setterID in appliedSetterIDs) { continue; }  // if we've already applied this setter, move on
                appliedSetterIDs[setterInfo.setterID] = true;

                setterInfo.setter(value);
            }
        }
    }


    //----------------------------------------------------------
    //
    // variables

    function getValue(varName) {
        var value = _model[varName];
        if (value === undefined) { log("Tangle: unknown variable: " + varName);  return 0; }
        return value;
    }

    function setValue(varName, value) {
        var obj = {};
        obj[varName] = value;
        setValues(obj);
    }

    function setValues(obj) {
        var changedVarNames = [];

        for (var varName in obj) {
            var value = obj[varName];
            var oldValue = _model[varName];
            if (oldValue === undefined) { log("Tangle: setting unknown variable: " + varName);  continue; }
            if (oldValue === value) { continue; }  // don't update if new value is the same

            _model[varName] = value;
            changedVarNames.push(varName);
        }

        if (changedVarNames.length) {
            applySettersForVariables(changedVarNames);
            updateModel();
        }
    }

    function getValuesForVariables(varNames) {
        var values = [];
        for (var i = 0, length = varNames.length; i < length; i++) {
            values.push(getValue(varNames[i]));
        }
        return values;
    }


    //----------------------------------------------------------
    //
    // model

    function setModel(modelClass) {
        var ModelClass = function () { };
        ModelClass.prototype = modelClass;
        _model = new ModelClass;

        updateModel(true);  // initialize and update
    }

    function updateModel(shouldInitialize) {
        var ShadowModel = function () {};  // make a shadow object, so we can see exactly which properties changed
        ShadowModel.prototype = _model;
        var shadowModel = new ShadowModel;

        if (shouldInitialize) { shadowModel.initialize(); }
        shadowModel.update();

        var changedVarNames = [];
        for (var varName in shadowModel) {
            if (!shadowModel.hasOwnProperty(varName)) { continue; }
            if (_model[varName] === shadowModel[varName]) { continue; }

            _model[varName] = shadowModel[varName];
            changedVarNames.push(varName);
        }

        applySettersForVariables(changedVarNames);
    }


    //----------------------------------------------------------
    //
    // debug

    function log (msg) {
        if (window.console) { window.console.log(msg); }
    }

};  // end of Tangle


//----------------------------------------------------------
//
// components

Tangle.classes = {};
Tangle.formats = {};

Tangle.formats["default"] = function (value) { return "" + value; };

/*
---
MooTools: the javascript framework

web build:
 - http://mootools.net/core/5b88354153bcb3b6ae280d7f56d4147a

packager build:
 - packager build Core/Core Core/Array Core/Event Core/Class Core/Element Core/Element.Event Core/Element.Dimensions Core/Fx Core/Fx.CSS Core/Fx.Tween Core/Fx.Morph Core/Fx.Transitions Core/DOMReady

copyrights:
  - [MooTools](http://mootools.net)

licenses:
  - [MIT License](http://mootools.net/license.txt)
...
*/
!function(){function t(t,e,i){if(r)for(var o=r.length;o--;){var s=r[o];n.call(t,s)&&e.call(i,s,t[s])}}this.MooTools={version:"1.6.0",build:"529422872adfff401b901b8b6c7ca5114ee95e2b"};var e=this.typeOf=function(t){if(null==t)return"null";if(null!=t.$family)return t.$family();if(t.nodeName){if(1==t.nodeType)return"element";if(3==t.nodeType)return/\S/.test(t.nodeValue)?"textnode":"whitespace"}else if("number"==typeof t.length){if("callee"in t)return"arguments";if("item"in t)return"collection"}return typeof t},n=(this.instanceOf=function(t,e){if(null==t)return!1;for(var n=t.$constructor||t.constructor;n;){if(n===e)return!0;n=n.parent}return!!t.hasOwnProperty&&t instanceof e},Object.prototype.hasOwnProperty),r=!0;for(var i in{toString:1})r=null;r&&(r=["hasOwnProperty","valueOf","isPrototypeOf","propertyIsEnumerable","toLocaleString","toString","constructor"]);var o=this.Function;o.prototype.overloadSetter=function(e){var n=this;return function(r,i){if(null==r)return this;if(e||"string"!=typeof r){for(var o in r)n.call(this,o,r[o]);t(r,n,this)}else n.call(this,r,i);return this}},o.prototype.overloadGetter=function(t){var e=this;return function(n){var r,i;if("string"!=typeof n?r=n:arguments.length>1?r=arguments:t&&(r=[n]),r){i={};for(var o=0;o<r.length;o++)i[r[o]]=e.call(this,r[o])}else i=e.call(this,n);return i}},o.prototype.extend=function(t,e){this[t]=e}.overloadSetter(),o.prototype.implement=function(t,e){this.prototype[t]=e}.overloadSetter();var s=Array.prototype.slice;Array.convert=function(t){return null==t?[]:a.isEnumerable(t)&&"string"!=typeof t?"array"==e(t)?t:s.call(t):[t]},o.convert=function(t){return"function"==e(t)?t:function(){return t}},Number.convert=function(t){var e=parseFloat(t);return isFinite(e)?e:null},String.convert=function(t){return t+""},o.from=o.convert,Number.from=Number.convert,String.from=String.convert,o.implement({hide:function(){return this.$hidden=!0,this},protect:function(){return this.$protected=!0,this}});var a=this.Type=function(t,n){if(t){var r=t.toLowerCase(),i=function(t){return e(t)==r};a["is"+t]=i,null!=n&&(n.prototype.$family=function(){return r}.hide())}return null==n?null:(n.extend(this),n.$constructor=a,n.prototype.$constructor=n,n)},u=Object.prototype.toString;a.isEnumerable=function(t){return null!=t&&"number"==typeof t.length&&"[object Function]"!=u.call(t)};var c={},l=function(t){var n=e(t.prototype);return c[n]||(c[n]=[])},h=function(t,n){if(!n||!n.$hidden){for(var r=l(this),i=0;i<r.length;i++){var o=r[i];"type"==e(o)?h.call(o,t,n):o.call(this,t,n)}var a=this.prototype[t];null!=a&&a.$protected||(this.prototype[t]=n),null==this[t]&&"function"==e(n)&&f.call(this,t,function(t){return n.apply(t,s.call(arguments,1))})}},f=function(t,e){if(!e||!e.$hidden){var n=this[t];null!=n&&n.$protected||(this[t]=e)}};a.implement({implement:h.overloadSetter(),extend:f.overloadSetter(),alias:function(t,e){h.call(this,t,this.prototype[e])}.overloadSetter(),mirror:function(t){return l(this).push(t),this}}),new a("Type",a);var p=function(t,e,n){var r=e!=Object,i=e.prototype;r&&(e=new a(t,e));for(var o=0,s=n.length;o<s;o++){var u=n[o],c=e[u],l=i[u];c&&c.protect(),r&&l&&e.implement(u,l.protect())}if(r){var h=i.propertyIsEnumerable(n[0]);e.forEachMethod=function(t){if(!h)for(var e=0,r=n.length;e<r;e++)t.call(i,i[n[e]],n[e]);for(var o in i)t.call(i,i[o],o)}}return p};p("String",String,["charAt","charCodeAt","concat","contains","indexOf","lastIndexOf","match","quote","replace","search","slice","split","substr","substring","trim","toLowerCase","toUpperCase"])("Array",Array,["pop","push","reverse","shift","sort","splice","unshift","concat","join","slice","indexOf","lastIndexOf","filter","forEach","every","map","some","reduce","reduceRight","contains"])("Number",Number,["toExponential","toFixed","toLocaleString","toPrecision"])("Function",o,["apply","call","bind"])("RegExp",RegExp,["exec","test"])("Object",Object,["create","defineProperty","defineProperties","keys","getPrototypeOf","getOwnPropertyDescriptor","getOwnPropertyNames","preventExtensions","isExtensible","seal","isSealed","freeze","isFrozen"])("Date",Date,["now"]),Object.extend=f.overloadSetter(),Date.extend("now",function(){return+new Date}),new a("Boolean",Boolean),Number.prototype.$family=function(){return isFinite(this)?"number":"null"}.hide(),Number.extend("random",function(t,e){return Math.floor(Math.random()*(e-t+1)+t)}),Array.implement({forEach:function(t,e){for(var n=0,r=this.length;n<r;n++)n in this&&t.call(e,this[n],n,this)},each:function(t,e){return Array.forEach(this,t,e),this}}),Object.extend({keys:function(e){var r=[];for(var i in e)n.call(e,i)&&r.push(i);return t(e,function(t){r.push(t)}),r},forEach:function(t,e,n){Object.keys(t).forEach(function(r){e.call(n,t[r],r,t)})}}),Object.each=Object.forEach;var d=function(t){switch(e(t)){case"array":return t.clone();case"object":return Object.clone(t);default:return t}};Array.implement("clone",function(){for(var t=this.length,e=new Array(t);t--;)e[t]=d(this[t]);return e});var m=function(t,n,r){switch(e(r)){case"object":"object"==e(t[n])?Object.merge(t[n],r):t[n]=Object.clone(r);break;case"array":t[n]=r.clone();break;default:t[n]=r}return t};Object.extend({merge:function(t,n,r){if("string"==e(n))return m(t,n,r);for(var i=1,o=arguments.length;i<o;i++){var s=arguments[i];for(var a in s)m(t,a,s[a])}return t},clone:function(t){var e={};for(var n in t)e[n]=d(t[n]);return e},append:function(t){for(var e=1,n=arguments.length;e<n;e++){var r=arguments[e]||{};for(var i in r)t[i]=r[i]}return t}}),["Object","WhiteSpace","TextNode","Collection","Arguments"].each(function(t){new a(t)});var v=Date.now();String.extend("uniqueID",function(){return(v++).toString(36)})}(),Array.implement({every:function(t,e){for(var n=0,r=this.length>>>0;n<r;n++)if(n in this&&!t.call(e,this[n],n,this))return!1;return!0},filter:function(t,e){for(var n,r=[],i=0,o=this.length>>>0;i<o;i++)i in this&&(n=this[i],t.call(e,n,i,this)&&r.push(n));return r},indexOf:function(t,e){for(var n=this.length>>>0,r=e<0?Math.max(0,n+e):e||0;r<n;r++)if(this[r]===t)return r;return-1},map:function(t,e){for(var n=this.length>>>0,r=Array(n),i=0;i<n;i++)i in this&&(r[i]=t.call(e,this[i],i,this));return r},some:function(t,e){for(var n=0,r=this.length>>>0;n<r;n++)if(n in this&&t.call(e,this[n],n,this))return!0;return!1},clean:function(){return this.filter(function(t){return null!=t})},invoke:function(t){var e=Array.slice(arguments,1);return this.map(function(n){return n[t].apply(n,e)})},associate:function(t){for(var e={},n=Math.min(this.length,t.length),r=0;r<n;r++)e[t[r]]=this[r];return e},link:function(t){for(var e={},n=0,r=this.length;n<r;n++)for(var i in t)if(t[i](this[n])){e[i]=this[n],delete t[i];break}return e},contains:function(t,e){return-1!=this.indexOf(t,e)},append:function(t){return this.push.apply(this,t),this},getLast:function(){return this.length?this[this.length-1]:null},getRandom:function(){return this.length?this[Number.random(0,this.length-1)]:null},include:function(t){return this.contains(t)||this.push(t),this},combine:function(t){for(var e=0,n=t.length;e<n;e++)this.include(t[e]);return this},erase:function(t){for(var e=this.length;e--;)this[e]===t&&this.splice(e,1);return this},empty:function(){return this.length=0,this},flatten:function(){for(var t=[],e=0,n=this.length;e<n;e++){var r=typeOf(this[e]);"null"!=r&&(t=t.concat("array"==r||"collection"==r||"arguments"==r||instanceOf(this[e],Array)?Array.flatten(this[e]):this[e]))}return t},pick:function(){for(var t=0,e=this.length;t<e;t++)if(null!=this[t])return this[t];return null},hexToRgb:function(t){if(3!=this.length)return null;var e=this.map(function(t){return 1==t.length&&(t+=t),parseInt(t,16)});return t?e:"rgb("+e+")"},rgbToHex:function(t){if(this.length<3)return null;if(4==this.length&&0==this[3]&&!t)return"transparent";for(var e=[],n=0;n<3;n++){var r=(this[n]-0).toString(16);e.push(1==r.length?"0"+r:r)}return t?e:"#"+e.join("")}}),String.implement({contains:function(t,e){return(e?String(this).slice(e):String(this)).indexOf(t)>-1},test:function(t,e){return("regexp"==typeOf(t)?t:new RegExp(""+t,e)).test(this)},trim:function(){return String(this).replace(/^\s+|\s+$/g,"")},clean:function(){return String(this).replace(/\s+/g," ").trim()},camelCase:function(){return String(this).replace(/-\D/g,function(t){return t.charAt(1).toUpperCase()})},hyphenate:function(){return String(this).replace(/[A-Z]/g,function(t){return"-"+t.charAt(0).toLowerCase()})},capitalize:function(){return String(this).replace(/\b[a-z]/g,function(t){return t.toUpperCase()})},escapeRegExp:function(){return String(this).replace(/([-.*+?^${}()|[\]\/\\])/g,"\\$1")},toInt:function(t){return parseInt(this,t||10)},toFloat:function(){return parseFloat(this)},hexToRgb:function(t){var e=String(this).match(/^#?(\w{1,2})(\w{1,2})(\w{1,2})$/);return e?e.slice(1).hexToRgb(t):null},rgbToHex:function(t){var e=String(this).match(/\d{1,3}/g);return e?e.rgbToHex(t):null},substitute:function(t,e){return String(this).replace(e||/\\?\{([^{}]+)\}/g,function(e,n){return"\\"==e.charAt(0)?e.slice(1):null!=t[n]?t[n]:""})}}),Function.extend({attempt:function(){for(var t=0,e=arguments.length;t<e;t++)try{return arguments[t]()}catch(t){}return null}}),Function.implement({attempt:function(t,e){try{return this.apply(e,Array.convert(t))}catch(t){}return null},bind:function(t){var e=this,n=arguments.length>1?Array.slice(arguments,1):null,r=function(){},i=function(){var o=t,s=arguments.length;this instanceof i&&(r.prototype=e.prototype,o=new r);var a=n||s?e.apply(o,n&&s?n.concat(Array.slice(arguments)):n||arguments):e.call(o);return o==t?a:o};return i},pass:function(t,e){var n=this;return null!=t&&(t=Array.convert(t)),function(){return n.apply(e,t||arguments)}},delay:function(t,e,n){return setTimeout(this.pass(null==n?[]:n,e),t)},periodical:function(t,e,n){return setInterval(this.pass(null==n?[]:n,e),t)}}),Number.implement({limit:function(t,e){return Math.min(e,Math.max(t,this))},round:function(t){return t=Math.pow(10,t||0).toFixed(t<0?-t:0),Math.round(this*t)/t},times:function(t,e){for(var n=0;n<this;n++)t.call(e,n,this)},toFloat:function(){return parseFloat(this)},toInt:function(t){return parseInt(this,t||10)}}),Number.alias("each","times"),function(t){var e={};t.each(function(t){Number[t]||(e[t]=function(){return Math[t].apply(null,[this].concat(Array.convert(arguments)))})}),Number.implement(e)}(["abs","acos","asin","atan","atan2","ceil","cos","exp","floor","log","max","min","pow","sin","sqrt","tan"]),function(){var t=this.Class=new Type("Class",function(r){instanceOf(r,Function)&&(r={initialize:r});var i=function(){if(n(this),i.$prototyping)return this;this.$caller=null,this.$family=null;var t=this.initialize?this.initialize.apply(this,arguments):this;return this.$caller=this.caller=null,t}.extend(this).implement(r);return i.$constructor=t,i.prototype.$constructor=i,i.prototype.parent=e,i}),e=function(){if(!this.$caller)throw new Error('The method "parent" cannot be called.');var t=this.$caller.$name,e=this.$caller.$owner.parent,n=e?e.prototype[t]:null;if(!n)throw new Error('The method "'+t+'" has no parent.');return n.apply(this,arguments)},n=function(t){for(var e in t){var r=t[e];switch(typeOf(r)){case"object":var i=function(){};i.prototype=r,t[e]=n(new i);break;case"array":t[e]=r.clone()}}return t},r=function(t,e,n){n.$origin&&(n=n.$origin);var r=function(){if(n.$protected&&null==this.$caller)throw new Error('The method "'+e+'" cannot be called.');var t=this.caller,i=this.$caller;this.caller=i,this.$caller=r;var o=n.apply(this,arguments);return this.$caller=i,this.caller=t,o}.extend({$owner:t,$origin:n,$name:e});return r},i=function(e,n,i){if(t.Mutators.hasOwnProperty(e)&&null==(n=t.Mutators[e].call(this,n)))return this;if("function"==typeOf(n)){if(n.$hidden)return this;this.prototype[e]=i?n:r(this,e,n)}else Object.merge(this.prototype,e,n);return this},o=function(t){t.$prototyping=!0;var e=new t;return delete t.$prototyping,e};t.implement("implement",i.overloadSetter()),t.Mutators={Extends:function(t){this.parent=t,this.prototype=o(t)},Implements:function(t){Array.convert(t).each(function(t){var e=new t;for(var n in e)i.call(this,n,e[n],!0)},this)}}}(),function(){var t=this.document,e=t.window=this,n=function(t,e){t=t.toLowerCase(),e=e?e.toLowerCase():"";var n=t.match(/(edge)[\s\/:]([\w\d\.]+)/);return n||(n=t.match(/(opera|ie|firefox|chrome|trident|crios|version)[\s\/:]([\w\d\.]+)?.*?(safari|(?:rv[\s\/:]|version[\s\/:])([\w\d\.]+)|$)/)||[null,"unknown",0]),"trident"==n[1]?(n[1]="ie",n[4]&&(n[2]=n[4])):"crios"==n[1]&&(n[1]="chrome"),e=t.match(/ip(?:ad|od|hone)/)?"ios":(t.match(/(?:webos|android)/)||t.match(/mac|win|linux/)||["other"])[0],"win"==e&&(e="windows"),{extend:Function.prototype.extend,name:"version"==n[1]?n[3]:n[1],version:parseFloat("opera"==n[1]&&n[4]?n[4]:n[2]),platform:e}},r=this.Browser=n(navigator.userAgent,navigator.platform);if("ie"==r.name&&t.documentMode&&(r.version=t.documentMode),r.extend({Features:{xpath:!!t.evaluate,air:!!e.runtime,query:!!t.querySelector,json:!!e.JSON},parseUA:n}),r.Request=function(){var t=function(){return new XMLHttpRequest},e=function(){return new ActiveXObject("MSXML2.XMLHTTP")},n=function(){return new ActiveXObject("Microsoft.XMLHTTP")};return Function.attempt(function(){return t(),t},function(){return e(),e},function(){return n(),n})}(),r.Features.xhr=!!r.Request,r.exec=function(n){if(!n)return n;if(e.execScript)e.execScript(n);else{var r=t.createElement("script");r.setAttribute("type","text/javascript"),r.text=n,t.head.appendChild(r),t.head.removeChild(r)}return n},String.implement("stripScripts",function(t){var e="",n=this.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi,function(t,n){return e+=n+"\n",""});return!0===t?r.exec(e):"function"==typeOf(t)&&t(e,n),n}),r.extend({Document:this.Document,Window:this.Window,Element:this.Element,Event:this.Event}),this.Window=this.$constructor=new Type("Window",function(){}),this.$family=Function.convert("window").hide(),Window.mirror(function(t,n){e[t]=n}),this.Document=t.$constructor=new Type("Document",function(){}),t.$family=Function.convert("document").hide(),Document.mirror(function(e,n){t[e]=n}),t.html=t.documentElement,t.head||(t.head=t.getElementsByTagName("head")[0]),t.execCommand)try{t.execCommand("BackgroundImageCache",!1,!0)}catch(t){}if(this.attachEvent&&!this.addEventListener){var i=function(){this.detachEvent("onunload",i),t.head=t.html=t.window=null,e=this.Window=t=null};this.attachEvent("onunload",i)}var o=Array.convert;try{o(t.html.childNodes)}catch(t){Array.convert=function(t){if("string"!=typeof t&&Type.isEnumerable(t)&&"array"!=typeOf(t)){for(var e=t.length,n=new Array(e);e--;)n[e]=t[e];return n}return o(t)};var s=Array.prototype,a=s.slice;["pop","push","reverse","shift","sort","splice","unshift","concat","join","slice"].each(function(t){var e=s[t];Array[t]=function(t){return e.apply(Array.convert(t),a.call(arguments,1))}})}}(),function(){Object.extend({subset:function(t,e){for(var n={},r=0,i=e.length;r<i;r++){var o=e[r];o in t&&(n[o]=t[o])}return n},map:function(t,e,n){for(var r={},i=Object.keys(t),o=0;o<i.length;o++){var s=i[o];r[s]=e.call(n,t[s],s,t)}return r},filter:function(t,e,n){for(var r={},i=Object.keys(t),o=0;o<i.length;o++){var s=i[o],a=t[s];e.call(n,a,s,t)&&(r[s]=a)}return r},every:function(t,e,n){for(var r=Object.keys(t),i=0;i<r.length;i++){var o=r[i];if(!e.call(n,t[o],o))return!1}return!0},some:function(t,e,n){for(var r=Object.keys(t),i=0;i<r.length;i++){var o=r[i];if(e.call(n,t[o],o))return!0}return!1},values:function(t){for(var e=[],n=Object.keys(t),r=0;r<n.length;r++){var i=n[r];e.push(t[i])}return e},getLength:function(t){return Object.keys(t).length},keyOf:function(t,e){for(var n=Object.keys(t),r=0;r<n.length;r++){var i=n[r];if(t[i]===e)return i}return null},contains:function(t,e){return null!=Object.keyOf(t,e)},toQueryString:function(t,e){var n=[];return Object.each(t,function(t,r){e&&(r=e+"["+r+"]");var i;switch(typeOf(t)){case"object":i=Object.toQueryString(t,r);break;case"array":var o={};t.each(function(t,e){o[e]=t}),i=Object.toQueryString(o,r);break;default:i=r+"="+encodeURIComponent(t)}null!=t&&n.push(i)}),n.join("&")}})}(),function(){var t={},e=function(t){var e;if(t.wheelDelta)e=t.wheelDelta%120==0?t.wheelDelta/120:t.wheelDelta/12;else{var n=t.deltaY||t.detail||0;e=-(n%3==0?n/3:10*n)}return e},n=this.DOMEvent=new Type("DOMEvent",function(n,r){if(r||(r=window),n=n||r.event,n.$extended)return n;this.event=n,this.$extended=!0,this.shift=n.shiftKey,this.control=n.ctrlKey,this.alt=n.altKey,this.meta=n.metaKey;for(var i=this.type=n.type,o=n.target||n.srcElement;o&&3==o.nodeType;)o=o.parentNode;if(this.target=document.id(o),0==i.indexOf("key")){var s=this.code=n.which||n.keyCode;this.shift&&"keypress"==i||(this.key=t[s]),"keydown"!=i&&"keyup"!=i||(s>111&&s<124?this.key="f"+(s-111):s>95&&s<106&&(this.key=s-96)),null==this.key&&(this.key=String.fromCharCode(s).toLowerCase())}else if("click"==i||"dblclick"==i||"contextmenu"==i||"wheel"==i||"DOMMouseScroll"==i||0==i.indexOf("mouse")){var a=r.document;if(a=a.compatMode&&"CSS1Compat"!=a.compatMode?a.body:a.html,this.page={x:null!=n.pageX?n.pageX:n.clientX+a.scrollLeft,y:null!=n.pageY?n.pageY:n.clientY+a.scrollTop},this.client={x:null!=n.pageX?n.pageX-r.pageXOffset:n.clientX,y:null!=n.pageY?n.pageY-r.pageYOffset:n.clientY},"DOMMouseScroll"!=i&&"wheel"!=i&&"mousewheel"!=i||(this.wheel=e(n)),this.rightClick=3==n.which||2==n.button,"mouseover"==i||"mouseout"==i||"mouseenter"==i||"mouseleave"==i){for(var u="mouseover"==i||"mouseenter"==i,c=n.relatedTarget||n[(u?"from":"to")+"Element"];c&&3==c.nodeType;)c=c.parentNode;this.relatedTarget=document.id(c)}}else if(0==i.indexOf("touch")||0==i.indexOf("gesture")){this.rotation=n.rotation,this.scale=n.scale,this.targetTouches=n.targetTouches,this.changedTouches=n.changedTouches;var l=this.touches=n.touches;if(l&&l[0]){var h=l[0];this.page={x:h.pageX,y:h.pageY},this.client={x:h.clientX,y:h.clientY}}}this.client||(this.client={}),this.page||(this.page={})});n.implement({stop:function(){return this.preventDefault().stopPropagation()},stopPropagation:function(){return this.event.stopPropagation?this.event.stopPropagation():this.event.cancelBubble=!0,this},preventDefault:function(){return this.event.preventDefault?this.event.preventDefault():this.event.returnValue=!1,this}}),n.defineKey=function(e,n){return t[e]=n,this},n.defineKeys=n.defineKey.overloadSetter(!0),n.defineKeys({38:"up",40:"down",37:"left",39:"right",27:"esc",32:"space",8:"backspace",9:"tab",46:"delete",13:"enter"})}(),function(){function t(t,o,s,u,l,f,p,d,m,v,g,y,b,E,x,S){if((o||-1===n)&&(e.expressions[++n]=[],r=-1,o))return"";if(s||u||-1===r){s=s||" ";var w=e.expressions[n];i&&w[r]&&(w[r].reverseCombinator=c(s)),w[++r]={combinator:s,tag:"*"}}var k=e.expressions[n][r];if(l)k.tag=l.replace(a,"");else if(f)k.id=f.replace(a,"");else if(p)p=p.replace(a,""),k.classList||(k.classList=[]),k.classes||(k.classes=[]),k.classList.push(p),k.classes.push({value:p,regexp:new RegExp("(^|\\s)"+h(p)+"(\\s|$)")});else if(b)S=S||x,S=S?S.replace(a,""):null,k.pseudos||(k.pseudos=[]),k.pseudos.push({key:b.replace(a,""),value:S,type:1==y.length?"class":"element"});else if(d){d=d.replace(a,""),g=(g||"").replace(a,"");var T,A;switch(m){case"^=":A=new RegExp("^"+h(g));break;case"$=":A=new RegExp(h(g)+"$");break;case"~=":A=new RegExp("(^|\\s)"+h(g)+"(\\s|$)");break;case"|=":A=new RegExp("^"+h(g)+"(-|$)");break;case"=":T=function(t){return g==t};break;case"*=":T=function(t){return t&&t.indexOf(g)>-1};break;case"!=":T=function(t){return g!=t};break;default:T=function(t){return!!t}}""==g&&/^[*$^]=$/.test(m)&&(T=function(){return!1}),T||(T=function(t){return t&&A.test(t)}),k.attributes||(k.attributes=[]),k.attributes.push({key:d,operator:m,value:g,test:T})}return""}var e,n,r,i,o={},s={},a=/\\/g,u=function(r,a){if(null==r)return null;if(!0===r.Slick)return r;r=(""+r).replace(/^\s+|\s+$/g,""),i=!!a;var c=i?s:o;if(c[r])return c[r];for(e={Slick:!0,expressions:[],raw:r,reverse:function(){return u(this.raw,!0)}},n=-1;r!=(r=r.replace(f,t)););return e.length=e.expressions.length,c[e.raw]=i?l(e):e},c=function(t){return"!"===t?" ":" "===t?"!":/^!/.test(t)?t.replace(/^!/,""):"!"+t},l=function(t){for(var e=t.expressions,n=0;n<e.length;n++){for(var r=e[n],i={parts:[],tag:"*",combinator:c(r[0].combinator)},o=0;o<r.length;o++){var s=r[o];s.reverseCombinator||(s.reverseCombinator=" "),s.combinator=s.reverseCombinator,delete s.reverseCombinator}r.reverse().push(i)}return t},h=function(t){return t.replace(/[-[\]{}()*+?.\\^$|,#\s]/g,function(t){return"\\"+t})},f=new RegExp("^(?:\\s*(,)\\s*|\\s*(<combinator>+)\\s*|(\\s+)|(<unicode>+|\\*)|\\#(<unicode>+)|\\.(<unicode>+)|\\[\\s*(<unicode1>+)(?:\\s*([*^$!~|]?=)(?:\\s*(?:([\"']?)(.*?)\\9)))?\\s*\\](?!\\])|(:+)(<unicode>+)(?:\\((?:(?:([\"'])([^\\13]*)\\13)|((?:\\([^)]+\\)|[^()]*)+))\\))?)".replace(/<combinator>/,"["+h(">+~`!@$%^&={}\\;</")+"]").replace(/<unicode>/g,"(?:[\\w\\u00a1-\\uFFFF-]|\\\\[^\\s0-9a-f])").replace(/<unicode1>/g,"(?:[:\\w\\u00a1-\\uFFFF-]|\\\\[^\\s0-9a-f])")),p=this.Slick||{};p.parse=function(t){return u(t)},p.escapeRegExp=h,this.Slick||(this.Slick=p)}.apply("undefined"!=typeof exports?exports:this),function(){var t={},e={},n=Object.prototype.toString;t.isNativeCode=function(t){return/\{\s*\[native code\]\s*\}/.test(""+t)},t.isXML=function(t){return!!t.xmlVersion||!!t.xml||"[object XMLDocument]"==n.call(t)||9==t.nodeType&&"HTML"!=t.documentElement.nodeName},t.setDocument=function(t){var n=t.nodeType;if(9==n);else if(n)t=t.ownerDocument;else{if(!t.navigator)return;t=t.document}if(this.document!==t){this.document=t;var r,i=t.documentElement,o=this.getUIDXML(i),s=e[o];if(s)for(r in s)this[r]=s[r];else{s=e[o]={},s.root=i,s.isXMLDocument=this.isXML(t),s.brokenStarGEBTN=s.starSelectsClosedQSA=s.idGetsName=s.brokenMixedCaseQSA=s.brokenGEBCN=s.brokenCheckedQSA=s.brokenEmptyAttributeQSA=s.isHTMLDocument=s.nativeMatchesSelector=!1;var a,u,c,l,h,f,p="slick_uniqueid",d=t.createElement("div"),m=t.body||t.getElementsByTagName("body")[0]||i;m.appendChild(d);try{d.innerHTML='<a id="'+p+'"></a>',s.isHTMLDocument=!!t.getElementById(p)}catch(t){}if(s.isHTMLDocument){d.style.display="none",d.appendChild(t.createComment("")),u=d.getElementsByTagName("*").length>1;try{d.innerHTML="foo</foo>",f=d.getElementsByTagName("*"),a=f&&!!f.length&&"/"==f[0].nodeName.charAt(0)}catch(t){}s.brokenStarGEBTN=u||a;try{d.innerHTML='<a name="'+p+'"></a><b id="'+p+'"></b>',s.idGetsName=t.getElementById(p)===d.firstChild}catch(t){}if(d.getElementsByClassName){try{d.innerHTML='<a class="f"></a><a class="b"></a>',d.getElementsByClassName("b").length,d.firstChild.className="b",l=2!=d.getElementsByClassName("b").length}catch(t){}try{d.innerHTML='<a class="a"></a><a class="f b a"></a>',c=2!=d.getElementsByClassName("a").length}catch(t){}s.brokenGEBCN=l||c}if(d.querySelectorAll){try{d.innerHTML="foo</foo>",f=d.querySelectorAll("*"),s.starSelectsClosedQSA=f&&!!f.length&&"/"==f[0].nodeName.charAt(0)}catch(t){}try{d.innerHTML='<a class="MiX"></a>',s.brokenMixedCaseQSA=!d.querySelectorAll(".MiX").length}catch(t){}try{d.innerHTML='<select><option selected="selected">a</option></select>',s.brokenCheckedQSA=0==d.querySelectorAll(":checked").length}catch(t){}try{d.innerHTML='<a class=""></a>',s.brokenEmptyAttributeQSA=0!=d.querySelectorAll('[class*=""]').length}catch(t){}}try{d.innerHTML='<form action="s"><input id="action"/></form>',h="s"!=d.firstChild.getAttribute("action")}catch(t){}if(s.nativeMatchesSelector=i.matches||i.mozMatchesSelector||i.webkitMatchesSelector,s.nativeMatchesSelector)try{s.nativeMatchesSelector.call(i,":slick"),s.nativeMatchesSelector=null}catch(t){}}try{i.slick_expando=1,delete i.slick_expando,s.getUID=this.getUIDHTML}catch(t){s.getUID=this.getUIDXML}m.removeChild(d),d=f=m=null,s.getAttribute=s.isHTMLDocument&&h?function(t,e){var n=this.attributeGetters[e];if(n)return n.call(t);var r=t.getAttributeNode(e);return r?r.nodeValue:null}:function(t,e){var n=this.attributeGetters[e];return n?n.call(t):t.getAttribute(e)},s.hasAttribute=i&&this.isNativeCode(i.hasAttribute)?function(t,e){return t.hasAttribute(e)}:function(t,e){return!(!(t=t.getAttributeNode(e))||!t.specified&&!t.nodeValue)};var v=i&&this.isNativeCode(i.contains),g=t&&this.isNativeCode(t.contains);s.contains=v&&g?function(t,e){return t.contains(e)}:v&&!g?function(e,n){return e===n||(e===t?t.documentElement:e).contains(n)}:i&&i.compareDocumentPosition?function(t,e){return t===e||!!(16&t.compareDocumentPosition(e))}:function(t,e){if(e)do{if(e===t)return!0}while(e=e.parentNode);return!1},s.documentSorter=i.compareDocumentPosition?function(t,e){return t.compareDocumentPosition&&e.compareDocumentPosition?4&t.compareDocumentPosition(e)?-1:t===e?0:1:0}:"sourceIndex"in i?function(t,e){return t.sourceIndex&&e.sourceIndex?t.sourceIndex-e.sourceIndex:0}:t.createRange?function(t,e){if(!t.ownerDocument||!e.ownerDocument)return 0;var n=t.ownerDocument.createRange(),r=e.ownerDocument.createRange();return n.setStart(t,0),n.setEnd(t,0),r.setStart(e,0),r.setEnd(e,0),n.compareBoundaryPoints(Range.START_TO_END,r)}:null,i=null;for(r in s)this[r]=s[r]}}};var r=/^([#.]?)((?:[\w-]+|\*))$/,i=/\[.+[*$^]=(?:""|'')?\]/,o={};t.search=function(t,e,n,s){var a=this.found=s?null:n||[];if(!t)return a;if(t.navigator)t=t.document;else if(!t.nodeType)return a;var u,c,l,f,p=this.uniques={},d=!(!n||!n.length),m=9==t.nodeType;if(this.document!==(m?t:t.ownerDocument)&&this.setDocument(t),d)for(c=a.length;c--;)p[this.getUID(a[c])]=!0;if("string"==typeof e){var v=e.match(r);t:if(v){var g=v[1],y=v[2];if(g){if("#"==g){if(!this.isHTMLDocument||!m)break t;if(!(l=t.getElementById(y)))return a;if(this.idGetsName&&l.getAttributeNode("id").nodeValue!=y)break t;if(s)return l||null;d&&p[this.getUID(l)]||a.push(l)}else if("."==g){if(!this.isHTMLDocument||(!t.getElementsByClassName||this.brokenGEBCN)&&t.querySelectorAll)break t;if(t.getElementsByClassName&&!this.brokenGEBCN){if(f=t.getElementsByClassName(y),s)return f[0]||null;for(c=0;l=f[c++];)d&&p[this.getUID(l)]||a.push(l)}else{var b=new RegExp("(^|\\s)"+h.escapeRegExp(y)+"(\\s|$)");for(f=t.getElementsByTagName("*"),c=0;l=f[c++];)if(className=l.className,className&&b.test(className)){if(s)return l;d&&p[this.getUID(l)]||a.push(l)}}}}else{if("*"==y&&this.brokenStarGEBTN)break t;if(f=t.getElementsByTagName(y),s)return f[0]||null;for(c=0;l=f[c++];)d&&p[this.getUID(l)]||a.push(l)}return d&&this.sort(a),s?null:a}t:if(t.querySelectorAll){if(!this.isHTMLDocument||o[e]||this.brokenMixedCaseQSA||this.brokenCheckedQSA&&e.indexOf(":checked")>-1||this.brokenEmptyAttributeQSA&&i.test(e)||!m&&e.indexOf(",")>-1||h.disableQSA)break t;var E,x=e,S=t;m||(E=S.getAttribute("id"),slickid="slickid__",S.setAttribute("id",slickid),x="#"+slickid+" "+x,t=S.parentNode);try{if(s)return t.querySelector(x)||null;f=t.querySelectorAll(x)}catch(t){o[e]=1;break t}finally{m||(E?S.setAttribute("id",E):S.removeAttribute("id"),t=S)}if(this.starSelectsClosedQSA)for(c=0;l=f[c++];)!(l.nodeName>"@")||d&&p[this.getUID(l)]||a.push(l);else for(c=0;l=f[c++];)d&&p[this.getUID(l)]||a.push(l);return d&&this.sort(a),a}if(u=this.Slick.parse(e),!u.length)return a}else{if(null==e)return a;if(!e.Slick)return this.contains(t.documentElement||t,e)?(a?a.push(e):a=e,a):a;u=e}this.posNTH={},this.posNTHLast={},this.posNTHType={},this.posNTHTypeLast={},this.push=!d&&(s||1==u.length&&1==u.expressions[0].length)?this.pushArray:this.pushUID,null==a&&(a=[]);var w,k,T,A,N,C,$,O,L,M,D,j,P,H,F=u.expressions;t:for(c=0;j=F[c];c++)for(w=0;P=j[w];w++){if(A="combinator:"+P.combinator,!this[A])continue t;if(N=this.isXMLDocument?P.tag:P.tag.toUpperCase(),C=P.id,$=P.classList,O=P.classes,L=P.attributes,M=P.pseudos,H=w===j.length-1,this.bitUniques={},H?(this.uniques=p,this.found=a):(this.uniques={},this.found=[]),0===w){if(this[A](t,N,C,O,L,M,$),s&&H&&a.length)break t}else if(s&&H){for(k=0,T=D.length;k<T;k++)if(this[A](D[k],N,C,O,L,M,$),a.length)break t}else for(k=0,T=D.length;k<T;k++)this[A](D[k],N,C,O,L,M,$);D=this.found}return(d||u.expressions.length>1)&&this.sort(a),s?a[0]||null:a},t.uidx=1,t.uidk="slick-uniqueid",t.getUIDXML=function(t){var e=t.getAttribute(this.uidk);return e||(e=this.uidx++,t.setAttribute(this.uidk,e)),e},t.getUIDHTML=function(t){return t.uniqueNumber||(t.uniqueNumber=this.uidx++)},t.sort=function(t){return this.documentSorter?(t.sort(this.documentSorter),t):t},t.cacheNTH={},t.matchNTH=/^([+-]?\d*)?([a-z]+)?([+-]\d+)?$/,t.parseNTHArgument=function(t){var e=t.match(this.matchNTH);if(!e)return!1;var n=e[2]||!1,r=e[1]||1;"-"==r&&(r=-1);var i=+e[3]||0;return e="n"==n?{a:r,b:i}:"odd"==n?{a:2,b:1}:"even"==n?{a:2,b:0}:{a:0,b:r},this.cacheNTH[t]=e},t.createNTHPseudo=function(t,e,n,r){return function(i,o){var s=this.getUID(i);if(!this[n][s]){var a=i.parentNode;if(!a)return!1;var u=a[t],c=1;if(r){var l=i.nodeName;do{u.nodeName==l&&(this[n][this.getUID(u)]=c++)}while(u=u[e])}else do{1==u.nodeType&&(this[n][this.getUID(u)]=c++)}while(u=u[e])}o=o||"n";var h=this.cacheNTH[o]||this.parseNTHArgument(o);if(!h)return!1;var f=h.a,p=h.b,d=this[n][s];if(0==f)return p==d;if(f>0){if(d<p)return!1}else if(p<d)return!1;return(d-p)%f==0}},t.pushArray=function(t,e,n,r,i,o){this.matchSelector(t,e,n,r,i,o)&&this.found.push(t)},t.pushUID=function(t,e,n,r,i,o){var s=this.getUID(t);!this.uniques[s]&&this.matchSelector(t,e,n,r,i,o)&&(this.uniques[s]=!0,this.found.push(t))},t.matchNode=function(t,e){if(this.isHTMLDocument&&this.nativeMatchesSelector)try{return this.nativeMatchesSelector.call(t,e.replace(/\[([^=]+)=\s*([^'"\]]+?)\s*\]/g,'[$1="$2"]'))}catch(t){}var n=this.Slick.parse(e);if(!n)return!0;var r,i,o=n.expressions,s=0;for(r=0;i=o[r];r++)if(1==i.length){var a=i[0];if(this.matchSelector(t,this.isXMLDocument?a.tag:a.tag.toUpperCase(),a.id,a.classes,a.attributes,a.pseudos))return!0;s++}if(s==n.length)return!1;var u,c=this.search(this.document,n);for(r=0;u=c[r++];)if(u===t)return!0;return!1},t.matchPseudo=function(t,e,n){var r="pseudo:"+e;if(this[r])return this[r](t,n);var i=this.getAttribute(t,e);return n?n==i:!!i},t.matchSelector=function(t,e,n,r,i,o){if(e){var s=this.isXMLDocument?t.nodeName:t.nodeName.toUpperCase();if("*"==e){if(s<"@")return!1}else if(s!=e)return!1}if(n&&t.getAttribute("id")!=n)return!1;var a,u,c;if(r)for(a=r.length;a--;)if(!(c=this.getAttribute(t,"class"))||!r[a].regexp.test(c))return!1;if(i)for(a=i.length;a--;)if(u=i[a],u.operator?!u.test(this.getAttribute(t,u.key)):!this.hasAttribute(t,u.key))return!1;if(o)for(a=o.length;a--;)if(u=o[a],!this.matchPseudo(t,u.key,u.value))return!1;return!0};var s={" ":function(t,e,n,r,i,o,s){var a,u,c;if(this.isHTMLDocument){t:if(n){if(!(u=this.document.getElementById(n))&&t.all||this.idGetsName&&u&&u.getAttributeNode("id").nodeValue!=n){if(!(c=t.all[n]))return;for(c[0]||(c=[c]),a=0;u=c[a++];){var l=u.getAttributeNode("id");if(l&&l.nodeValue==n){this.push(u,e,null,r,i,o);break}}return}if(!u){if(this.contains(this.root,t))return;break t}if(this.document!==t&&!this.contains(t,u))return;return void this.push(u,e,null,r,i,o)}t:if(r&&t.getElementsByClassName&&!this.brokenGEBCN){if(!(c=t.getElementsByClassName(s.join(" ")))||!c.length)break t;for(a=0;u=c[a++];)this.push(u,e,n,null,i,o);return}}if((c=t.getElementsByTagName(e))&&c.length)for(this.brokenStarGEBTN||(e=null),a=0;u=c[a++];)this.push(u,e,n,r,i,o)},">":function(t,e,n,r,i,o){if(t=t.firstChild)do{1==t.nodeType&&this.push(t,e,n,r,i,o)}while(t=t.nextSibling)},"+":function(t,e,n,r,i,o){for(;t=t.nextSibling;)if(1==t.nodeType){this.push(t,e,n,r,i,o);break}},"^":function(t,e,n,r,i,o){(t=t.firstChild)&&(1==t.nodeType?this.push(t,e,n,r,i,o):this["combinator:+"](t,e,n,r,i,o))},"~":function(t,e,n,r,i,o){for(;t=t.nextSibling;)if(1==t.nodeType){var s=this.getUID(t);if(this.bitUniques[s])break;this.bitUniques[s]=!0,this.push(t,e,n,r,i,o)}},"++":function(t,e,n,r,i,o){this["combinator:+"](t,e,n,r,i,o),this["combinator:!+"](t,e,n,r,i,o)},"~~":function(t,e,n,r,i,o){this["combinator:~"](t,e,n,r,i,o),this["combinator:!~"](t,e,n,r,i,o)},"!":function(t,e,n,r,i,o){
for(;t=t.parentNode;)t!==this.document&&this.push(t,e,n,r,i,o)},"!>":function(t,e,n,r,i,o){(t=t.parentNode)!==this.document&&this.push(t,e,n,r,i,o)},"!+":function(t,e,n,r,i,o){for(;t=t.previousSibling;)if(1==t.nodeType){this.push(t,e,n,r,i,o);break}},"!^":function(t,e,n,r,i,o){(t=t.lastChild)&&(1==t.nodeType?this.push(t,e,n,r,i,o):this["combinator:!+"](t,e,n,r,i,o))},"!~":function(t,e,n,r,i,o){for(;t=t.previousSibling;)if(1==t.nodeType){var s=this.getUID(t);if(this.bitUniques[s])break;this.bitUniques[s]=!0,this.push(t,e,n,r,i,o)}}};for(var a in s)t["combinator:"+a]=s[a];var u={empty:function(t){var e=t.firstChild;return!(e&&1==e.nodeType||(t.innerText||t.textContent||"").length)},not:function(t,e){return!this.matchNode(t,e)},contains:function(t,e){return(t.innerText||t.textContent||"").indexOf(e)>-1},"first-child":function(t){for(;t=t.previousSibling;)if(1==t.nodeType)return!1;return!0},"last-child":function(t){for(;t=t.nextSibling;)if(1==t.nodeType)return!1;return!0},"only-child":function(t){for(var e=t;e=e.previousSibling;)if(1==e.nodeType)return!1;for(var n=t;n=n.nextSibling;)if(1==n.nodeType)return!1;return!0},"nth-child":t.createNTHPseudo("firstChild","nextSibling","posNTH"),"nth-last-child":t.createNTHPseudo("lastChild","previousSibling","posNTHLast"),"nth-of-type":t.createNTHPseudo("firstChild","nextSibling","posNTHType",!0),"nth-last-of-type":t.createNTHPseudo("lastChild","previousSibling","posNTHTypeLast",!0),index:function(t,e){return this["pseudo:nth-child"](t,""+(e+1))},even:function(t){return this["pseudo:nth-child"](t,"2n")},odd:function(t){return this["pseudo:nth-child"](t,"2n+1")},"first-of-type":function(t){for(var e=t.nodeName;t=t.previousSibling;)if(t.nodeName==e)return!1;return!0},"last-of-type":function(t){for(var e=t.nodeName;t=t.nextSibling;)if(t.nodeName==e)return!1;return!0},"only-of-type":function(t){for(var e=t,n=t.nodeName;e=e.previousSibling;)if(e.nodeName==n)return!1;for(var r=t;r=r.nextSibling;)if(r.nodeName==n)return!1;return!0},enabled:function(t){return!t.disabled},disabled:function(t){return t.disabled},checked:function(t){return t.checked||t.selected},focus:function(t){return this.isHTMLDocument&&this.document.activeElement===t&&(t.href||t.type||this.hasAttribute(t,"tabindex"))},root:function(t){return t===this.root},selected:function(t){return t.selected}};for(var c in u)t["pseudo:"+c]=u[c];var l=t.attributeGetters={for:function(){return"htmlFor"in this?this.htmlFor:this.getAttribute("for")},href:function(){return"href"in this?this.getAttribute("href",2):this.getAttribute("href")},style:function(){return this.style?this.style.cssText:this.getAttribute("style")},tabindex:function(){var t=this.getAttributeNode("tabindex");return t&&t.specified?t.nodeValue:null},type:function(){return this.getAttribute("type")},maxlength:function(){var t=this.getAttributeNode("maxLength");return t&&t.specified?t.nodeValue:null}};l.MAXLENGTH=l.maxLength=l.maxlength;var h=t.Slick=this.Slick||{};h.version="1.1.7",h.search=function(e,n,r){return t.search(e,n,r)},h.find=function(e,n){return t.search(e,n,null,!0)},h.contains=function(e,n){return t.setDocument(e),t.contains(e,n)},h.getAttribute=function(e,n){return t.setDocument(e),t.getAttribute(e,n)},h.hasAttribute=function(e,n){return t.setDocument(e),t.hasAttribute(e,n)},h.match=function(e,n){return!(!e||!n)&&(!n||n===e||(t.setDocument(e),t.matchNode(e,n)))},h.defineAttributeGetter=function(e,n){return t.attributeGetters[e]=n,this},h.lookupAttributeGetter=function(e){return t.attributeGetters[e]},h.definePseudo=function(e,n){return t["pseudo:"+e]=function(t,e){return n.call(t,e)},this},h.lookupPseudo=function(e){var n=t["pseudo:"+e];return n?function(t){return n.call(this,t)}:null},h.override=function(e,n){return t.override(e,n),this},h.isXML=t.isXML,h.uidOf=function(e){return t.getUIDHTML(e)},this.Slick||(this.Slick=h)}.apply("undefined"!=typeof exports?exports:this);var Element=this.Element=function(t,e){var n=Element.Constructors[t];if(n)return n(e);if("string"!=typeof t)return document.id(t).set(e);if(e||(e={}),!/^[\w-]+$/.test(t)){var r=Slick.parse(t).expressions[0][0];t="*"==r.tag?"div":r.tag,r.id&&null==e.id&&(e.id=r.id);var i=r.attributes;if(i)for(var o,s=0,a=i.length;s<a;s++)o=i[s],null==e[o.key]&&(null!=o.value&&"="==o.operator?e[o.key]=o.value:o.value||o.operator||(e[o.key]=!0));r.classList&&null==e.class&&(e.class=r.classList.join(" "))}return document.newElement(t,e)};Browser.Element&&(Element.prototype=Browser.Element.prototype,Element.prototype._fireEvent=function(t){return function(e,n){return t.call(this,e,n)}}(Element.prototype.fireEvent)),new Type("Element",Element).mirror(function(t){if(!Array.prototype[t]){var e={};e[t]=function(){for(var e=[],n=arguments,r=!0,i=0,o=this.length;i<o;i++){var s=this[i],a=e[i]=s[t].apply(s,n);r=r&&"element"==typeOf(a)}return r?new Elements(e):e},Elements.implement(e)}}),Browser.Element||(Element.parent=Object,Element.Prototype={$constructor:Element,$family:Function.convert("element").hide()},Element.mirror(function(t,e){Element.Prototype[t]=e})),Element.Constructors={};var IFrame=new Type("IFrame",function(){var t,e=Array.link(arguments,{properties:Type.isObject,iframe:function(t){return null!=t}}),n=e.properties||{};e.iframe&&(t=document.id(e.iframe));var r=n.onload||function(){};delete n.onload,n.id=n.name=[n.id,n.name,t?t.id||t.name:"IFrame_"+String.uniqueID()].pick(),t=new Element(t||"iframe",n);var i=function(){r.call(t.contentWindow)};return window.frames[n.id]?i():t.addListener("load",i),t}),Elements=this.Elements=function(t){if(t&&t.length)for(var e,n={},r=0;e=t[r++];){var i=Slick.uidOf(e);n[i]||(n[i]=!0,this.push(e))}};Elements.prototype={length:0},Elements.parent=Array,new Type("Elements",Elements).implement({filter:function(t,e){return t?new Elements(Array.filter(this,"string"==typeOf(t)?function(e){return e.match(t)}:t,e)):this}.protect(),push:function(){for(var t=this.length,e=0,n=arguments.length;e<n;e++){var r=document.id(arguments[e]);r&&(this[t++]=r)}return this.length=t}.protect(),unshift:function(){for(var t=[],e=0,n=arguments.length;e<n;e++){var r=document.id(arguments[e]);r&&t.push(r)}return Array.prototype.unshift.apply(this,t)}.protect(),concat:function(){for(var t=new Elements(this),e=0,n=arguments.length;e<n;e++){var r=arguments[e];Type.isEnumerable(r)?t.append(r):t.push(r)}return t}.protect(),append:function(t){for(var e=0,n=t.length;e<n;e++)this.push(t[e]);return this}.protect(),empty:function(){for(;this.length;)delete this[--this.length];return this}.protect()}),function(){var t=Array.prototype.splice,e={0:0,1:1,length:2};t.call(e,1,1),1==e[1]&&Elements.implement("splice",function(){for(var e=this.length,n=t.apply(this,arguments);e>=this.length;)delete this[e--];return n}.protect()),Array.forEachMethod(function(t,e){Elements.implement(e,t)}),Array.mirror(Elements);var n;try{n="x"==document.createElement("<input name=x>").name}catch(t){}var r=function(t){return(""+t).replace(/&/g,"&amp;").replace(/"/g,"&quot;")},i=function(){var t=document.createElement("style"),e=!1;try{t.innerHTML="#justTesing{margin: 0px;}",e=!!t.innerHTML}catch(t){}return e}();Document.implement({newElement:function(t,e){if(e){if(null!=e.checked&&(e.defaultChecked=e.checked),"checkbox"!=e.type&&"radio"!=e.type||null!=e.value||(e.value="on"),!i&&"style"==t){var o=document.createElement("style");return o.setAttribute("type","text/css"),e.type&&delete e.type,this.id(o).set(e)}n&&(t="<"+t,e.name&&(t+=' name="'+r(e.name)+'"'),e.type&&(t+=' type="'+r(e.type)+'"'),t+=">",delete e.name,delete e.type)}return this.id(this.createElement(t)).set(e)}})}(),function(){Slick.uidOf(window),Slick.uidOf(document),Document.implement({newTextNode:function(t){return this.createTextNode(t)},getDocument:function(){return this},getWindow:function(){return this.window},id:function(){var t={string:function(e,n,r){return e=Slick.find(r,"#"+e.replace(/(\W)/g,"\\$1")),e?t.element(e,n):null},element:function(t,e){if(Slick.uidOf(t),!e&&!t.$family&&!/^(?:object|embed)$/i.test(t.tagName)){var n=t.fireEvent;t._fireEvent=function(t,e){return n(t,e)},Object.append(t,Element.Prototype)}return t},object:function(e,n,r){return e.toElement?t.element(e.toElement(r),n):null}};return t.textnode=t.whitespace=t.window=t.document=function(t){return t},function(e,n,r){if(e&&e.$family&&e.uniqueNumber)return e;var i=typeOf(e);return t[i]?t[i](e,n,r||document):null}}()}),null==window.$&&Window.implement("$",function(t,e){return document.id(t,e,this.document)}),Window.implement({getDocument:function(){return this.document},getWindow:function(){return this}}),[Document,Element].invoke("implement",{getElements:function(t){return Slick.search(this,t,new Elements)},getElement:function(t){return document.id(Slick.find(this,t))}});var t={contains:function(t){return Slick.contains(this,t)}};document.contains||Document.implement(t),document.createElement("div").contains||Element.implement(t);var e=function(t,e){if(!t)return e;t=Object.clone(Slick.parse(t));for(var n=t.expressions,r=n.length;r--;)n[r][0].combinator=e;return t};Object.forEach({getNext:"~",getPrevious:"!~",getParent:"!"},function(t,n){Element.implement(n,function(n){return this.getElement(e(n,t))})}),Object.forEach({getAllNext:"~",getAllPrevious:"!~",getSiblings:"~~",getChildren:">",getParents:"!"},function(t,n){Element.implement(n,function(n){return this.getElements(e(n,t))})}),Element.implement({getFirst:function(t){return document.id(Slick.search(this,e(t,">"))[0])},getLast:function(t){return document.id(Slick.search(this,e(t,">")).getLast())},getWindow:function(){return this.ownerDocument.window},getDocument:function(){return this.ownerDocument},getElementById:function(t){return document.id(Slick.find(this,"#"+(""+t).replace(/(\W)/g,"\\$1")))},match:function(t){return!t||Slick.match(this,t)}}),null==window.$$&&Window.implement("$$",function(t){if(1==arguments.length){if("string"==typeof t)return Slick.search(this.document,t,new Elements);if(Type.isEnumerable(t))return new Elements(t)}return new Elements(arguments)});var n={before:function(t,e){var n=e.parentNode;n&&n.insertBefore(t,e)},after:function(t,e){var n=e.parentNode;n&&n.insertBefore(t,e.nextSibling)},bottom:function(t,e){e.appendChild(t)},top:function(t,e){e.insertBefore(t,e.firstChild)}};n.inside=n.bottom;var r={},i={},o={};Array.forEach(["type","value","defaultValue","accessKey","cellPadding","cellSpacing","colSpan","frameBorder","rowSpan","tabIndex","useMap"],function(t){o[t.toLowerCase()]=t}),o.html="innerHTML",o.text=null==document.createElement("div").textContent?"innerText":"textContent",Object.forEach(o,function(t,e){i[e]=function(e,n){e[t]=n},r[e]=function(e){return e[t]}}),i.text=function(){return function(t,e){"style"==t.get("tag")?t.set("html",e):t[o.text]=e}}(i.text),r.text=function(t){return function(e){return"style"==e.get("tag")?e.innerHTML:t(e)}}(r.text);var s=["compact","nowrap","ismap","declare","noshade","checked","disabled","readOnly","multiple","selected","noresize","defer","defaultChecked","autofocus","controls","autoplay","loop"],a={};Array.forEach(s,function(t){var e=t.toLowerCase();a[e]=t,i[e]=function(e,n){e[t]=!!n},r[e]=function(e){return!!e[t]}}),Object.append(i,{class:function(t,e){"className"in t?t.className=e||"":t.setAttribute("class",e)},for:function(t,e){"htmlFor"in t?t.htmlFor=e:t.setAttribute("for",e)},style:function(t,e){t.style?t.style.cssText=e:t.setAttribute("style",e)},value:function(t,e){t.value=null!=e?e:""}}),r.class=function(t){return"className"in t?t.className||null:t.getAttribute("class")};var u=document.createElement("button");try{u.type="button"}catch(t){}"button"!=u.type&&(i.type=function(t,e){t.setAttribute("type",e)}),u=null;var c,h,f=function(){var t=document.createElement("style"),e=!1;try{t.innerHTML="#justTesing{margin: 0px;}",e=!!t.innerHTML}catch(t){}return e}(),p=document.createElement("input");p.value="t",p.type="submit",c="t"!=p.value;try{p.value="",p.type="email",h="email"==p.type}catch(t){}p=null,!c&&h||(i.type=function(t,e){try{var n=t.value;t.type=e,t.value=n}catch(t){}});var d=function(t){return t.random="attribute","attribute"==t.getAttribute("random")}(document.createElement("div")),m=function(t){return t.innerHTML='<object><param name="should_fix" value="the unknown" /></object>',1!=t.cloneNode(!0).firstChild.childNodes.length}(document.createElement("div")),v=!!document.createElement("div").classList,g=function(t){var e=(t||"").clean().split(" "),n={};return e.filter(function(t){if(""!==t&&!n[t])return n[t]=t})},y=function(t){this.classList.add(t)},b=function(t){this.classList.remove(t)};Element.implement({setProperty:function(t,e){var n=i[t.toLowerCase()];if(n)n(this,e);else{var r;d&&(r=this.retrieve("$attributeWhiteList",{})),null==e?(this.removeAttribute(t),d&&delete r[t]):(this.setAttribute(t,""+e),d&&(r[t]=!0))}return this},setProperties:function(t){for(var e in t)this.setProperty(e,t[e]);return this},getProperty:function(t){var e=r[t.toLowerCase()];if(e)return e(this);if(d){var n=this.getAttributeNode(t),i=this.retrieve("$attributeWhiteList",{});if(!n)return null;if(n.expando&&!i[t]){var o=this.outerHTML;if(o.substr(0,o.search(/\/?['"]?>(?![^<]*<['"])/)).indexOf(t)<0)return null;i[t]=!0}}var s=Slick.getAttribute(this,t);return s||Slick.hasAttribute(this,t)?s:null},getProperties:function(){var t=Array.convert(arguments);return t.map(this.getProperty,this).associate(t)},removeProperty:function(t){return this.setProperty(t,null)},removeProperties:function(){return Array.each(arguments,this.removeProperty,this),this},set:function(t,e){var n=Element.Properties[t];n&&n.set?n.set.call(this,e):this.setProperty(t,e)}.overloadSetter(),get:function(t){var e=Element.Properties[t];return e&&e.get?e.get.apply(this):this.getProperty(t)}.overloadGetter(),erase:function(t){var e=Element.Properties[t];return e&&e.erase?e.erase.apply(this):this.removeProperty(t),this},hasClass:v?function(t){return this.classList.contains(t)}:function(t){return g(this.className).contains(t)},addClass:v?function(t){return g(t).forEach(y,this),this}:function(t){return this.className=g(t+" "+this.className).join(" "),this},removeClass:v?function(t){return g(t).forEach(b,this),this}:function(t){var e=g(this.className);return g(t).forEach(e.erase,e),this.className=e.join(" "),this},toggleClass:function(t,e){return null==e&&(e=!this.hasClass(t)),e?this.addClass(t):this.removeClass(t)},adopt:function(){var t,e=this,n=Array.flatten(arguments),r=n.length;r>1&&(e=t=document.createDocumentFragment());for(var i=0;i<r;i++){var o=document.id(n[i],!0);o&&e.appendChild(o)}return t&&this.appendChild(t),this},appendText:function(t,e){return this.grab(this.getDocument().newTextNode(t),e)},grab:function(t,e){return n[e||"bottom"](document.id(t,!0),this),this},inject:function(t,e){return n[e||"bottom"](this,document.id(t,!0)),this},replaces:function(t){return t=document.id(t,!0),t.parentNode.replaceChild(this,t),this},wraps:function(t,e){return t=document.id(t,!0),this.replaces(t).grab(t,e)},getSelected:function(){return this.selectedIndex,new Elements(Array.convert(this.options).filter(function(t){return t.selected}))},toQueryString:function(){var t=[];return this.getElements("input, select, textarea").each(function(e){var n=e.type;if(e.name&&!e.disabled&&"submit"!=n&&"reset"!=n&&"file"!=n&&"image"!=n){var r="select"==e.get("tag")?e.getSelected().map(function(t){return document.id(t).get("value")}):"radio"!=n&&"checkbox"!=n||e.checked?e.get("value"):null;Array.convert(r).each(function(n){void 0!==n&&t.push(encodeURIComponent(e.name)+"="+encodeURIComponent(n))})}}),t.join("&")}});var E={before:"beforeBegin",after:"afterEnd",bottom:"beforeEnd",top:"afterBegin",inside:"beforeEnd"};Element.implement("appendHTML","insertAdjacentHTML"in document.createElement("div")?function(t,e){return this.insertAdjacentHTML(E[e||"bottom"],t),this}:function(t,e){var r=new Element("div",{html:t}),i=r.childNodes,o=r.firstChild;if(!o)return this;if(i.length>1){o=document.createDocumentFragment();for(var s=0,a=i.length;s<a;s++)o.appendChild(i[s])}return n[e||"bottom"](o,this),this});var x={},S={},w=function(t){return S[t]||(S[t]={})},k=function(t){var e=t.uniqueNumber;return t.removeEvents&&t.removeEvents(),t.clearAttributes&&t.clearAttributes(),null!=e&&(delete x[e],delete S[e]),t},T={input:"checked",option:"selected",textarea:"value"};if(Element.implement({destroy:function(){var t=k(this).getElementsByTagName("*");return Array.each(t,k),Element.dispose(this),null},empty:function(){return Array.convert(this.childNodes).each(Element.dispose),this},dispose:function(){return this.parentNode?this.parentNode.removeChild(this):this},clone:function(t,e){t=!1!==t;var n,r=this.cloneNode(t),i=[r],o=[this];for(t&&(i.append(Array.convert(r.getElementsByTagName("*"))),o.append(Array.convert(this.getElementsByTagName("*")))),n=i.length;n--;){var s=i[n],a=o[n];if(e||s.removeAttribute("id"),s.clearAttributes&&(s.clearAttributes(),s.mergeAttributes(a),s.removeAttribute("uniqueNumber"),s.options))for(var u=s.options,c=a.options,l=u.length;l--;)u[l].selected=c[l].selected;var h=T[a.tagName.toLowerCase()];h&&a[h]&&(s[h]=a[h])}if(m){var f=r.getElementsByTagName("object"),p=this.getElementsByTagName("object");for(n=f.length;n--;)f[n].outerHTML=p[n].outerHTML}return document.id(r)}}),[Element,Window,Document].invoke("implement",{addListener:function(t,e){return window.attachEvent&&!window.addEventListener&&(x[Slick.uidOf(this)]=this),this.addEventListener?this.addEventListener(t,e,!!arguments[2]):this.attachEvent("on"+t,e),this},removeListener:function(t,e){return this.removeEventListener?this.removeEventListener(t,e,!!arguments[2]):this.detachEvent("on"+t,e),this},retrieve:function(t,e){var n=w(Slick.uidOf(this)),r=n[t];return null!=e&&null==r&&(r=n[t]=e),null!=r?r:null},store:function(t,e){return w(Slick.uidOf(this))[t]=e,this},eliminate:function(t){return delete w(Slick.uidOf(this))[t],this}}),window.attachEvent&&!window.addEventListener){var A=function(){Object.each(x,k),window.CollectGarbage&&CollectGarbage(),window.removeListener("unload",A)};window.addListener("unload",A)}Element.Properties={},Element.Properties.style={set:function(t){this.style.cssText=t},get:function(){return this.style.cssText},erase:function(){this.style.cssText=""}},Element.Properties.tag={get:function(){return this.tagName.toLowerCase()}},Element.Properties.html={set:function(t){null==t?t="":"array"==typeOf(t)&&(t=t.join("")),this.styleSheet&&!f?this.styleSheet.cssText=t:this.innerHTML=t},erase:function(){this.set("html","")}};var N,C=!0,$=!0,O=!0,L=document.createElement("div");if(L.innerHTML="<nav></nav>",!(C=1==L.childNodes.length)){var M="abbr article aside audio canvas datalist details figcaption figure footer header hgroup mark meter nav output progress section summary time video".split(" ");for(N=document.createDocumentFragment(),l=M.length;l--;)N.createElement(M[l])}L=null,$=Function.attempt(function(){return document.createElement("table").innerHTML="<tr><td></td></tr>",!0});var D=document.createElement("tr");D.innerHTML="<td></td>",O="<td></td>"==D.innerHTML,D=null,$&&O&&C||(Element.Properties.html.set=function(t){var e={table:[1,"<table>","</table>"],select:[1,"<select>","</select>"],tbody:[2,"<table><tbody>","</tbody></table>"],tr:[3,"<table><tbody><tr>","</tr></tbody></table>"]};return e.thead=e.tfoot=e.tbody,function(n){if(this.styleSheet)return t.call(this,n);var r=e[this.get("tag")];if(r||C||(r=[0,"",""]),!r)return t.call(this,n);var i=r[0],o=document.createElement("div"),s=o;for(C||N.appendChild(o),o.innerHTML=[r[1],n,r[2]].flatten().join("");i--;)s=s.firstChild;this.empty().adopt(s.childNodes),C||N.removeChild(o),o=null}}(Element.Properties.html.set));var j=document.createElement("form");j.innerHTML="<select><option>s</option></select>","s"!=j.firstChild.value&&(Element.Properties.value={set:function(t){if("select"!=this.get("tag"))return this.setProperty("value",t);var e=this.getElements("option");t=String(t);for(var n=0;n<e.length;n++){var r=e[n],i=r.getAttributeNode("value");if((i&&i.specified?r.value:r.get("text"))===t)return r.selected=!0}},get:function(){var t=this,e=t.get("tag");if("select"!=e&&"option"!=e)return this.getProperty("value");if("select"==e&&!(t=t.getSelected()[0]))return"";var n=t.getAttributeNode("value");return n&&n.specified?t.value:t.get("text")}}),j=null,document.createElement("div").getAttributeNode("id")&&(Element.Properties.id={set:function(t){this.id=this.getAttributeNode("id").value=t},get:function(){return this.id||null},erase:function(){this.id=this.getAttributeNode("id").value=""}})}(),function(){Element.Properties.events={set:function(t){this.addEvents(t)}},[Element,Window,Document].invoke("implement",{addEvent:function(t,e){var n=this.retrieve("events",{});if(n[t]||(n[t]={keys:[],values:[]}),n[t].keys.contains(e))return this;n[t].keys.push(e);var r=t,i=Element.Events[t],o=e,s=this;i&&(i.onAdd&&i.onAdd.call(this,e,t),i.condition&&(o=function(n){return!i.condition.call(this,n,t)||e.call(this,n)}),i.base&&(r=Function.convert(i.base).call(this,t)));var a=function(){return e.call(s)},u=Element.NativeEvents[r];return u&&(2==u&&(a=function(t){t=new DOMEvent(t,s.getWindow()),!1===o.call(s,t)&&t.stop()}),this.addListener(r,a,arguments[2])),n[t].values.push(a),this},removeEvent:function(t,e){var n=this.retrieve("events");if(!n||!n[t])return this;var r=n[t],i=r.keys.indexOf(e);if(-1==i)return this;var o=r.values[i];delete r.keys[i],delete r.values[i];var s=Element.Events[t];return s&&(s.onRemove&&s.onRemove.call(this,e,t),s.base&&(t=Function.convert(s.base).call(this,t))),Element.NativeEvents[t]?this.removeListener(t,o,arguments[2]):this},addEvents:function(t){for(var e in t)this.addEvent(e,t[e]);return this},removeEvents:function(t){var e;if("object"==typeOf(t)){for(e in t)this.removeEvent(e,t[e]);return this}var n=this.retrieve("events");if(!n)return this;if(t)n[t]&&(n[t].keys.each(function(e){this.removeEvent(t,e)},this),delete n[t]);else{for(e in n)this.removeEvents(e);this.eliminate("events")}return this},fireEvent:function(t,e,n){var r=this.retrieve("events");return r&&r[t]?(e=Array.convert(e),r[t].keys.each(function(t){n?t.delay(n,this,e):t.apply(this,e)},this),this):this},cloneEvents:function(t,e){t=document.id(t);var n=t.retrieve("events");if(!n)return this;if(e)n[e]&&n[e].keys.each(function(t){this.addEvent(e,t)},this);else for(var r in n)this.cloneEvents(t,r);return this}}),Element.NativeEvents={click:2,dblclick:2,mouseup:2,mousedown:2,contextmenu:2,wheel:2,mousewheel:2,DOMMouseScroll:2,mouseover:2,mouseout:2,mousemove:2,selectstart:2,selectend:2,keydown:2,keypress:2,keyup:2,orientationchange:2,touchstart:2,touchmove:2,touchend:2,touchcancel:2,gesturestart:2,gesturechange:2,gestureend:2,focus:2,blur:2,change:2,reset:2,select:2,submit:2,paste:2,input:2,load:2,unload:1,beforeunload:2,resize:1,move:1,DOMContentLoaded:1,readystatechange:1,hashchange:1,popstate:2,pageshow:2,pagehide:2,error:1,abort:1,scroll:1,message:2},Element.Events={mousewheel:{base:"onwheel"in document?"wheel":"onmousewheel"in document?"mousewheel":"DOMMouseScroll"}};var t=function(t){var e=t.relatedTarget;return null==e||!!e&&(e!=this&&"xul"!=e.prefix&&"document"!=typeOf(this)&&!this.contains(e))};"onmouseenter"in document.documentElement?(Element.NativeEvents.mouseenter=Element.NativeEvents.mouseleave=2,Element.MouseenterCheck=t):(Element.Events.mouseenter={base:"mouseover",condition:t},Element.Events.mouseleave={base:"mouseout",condition:t}),window.addEventListener||(Element.NativeEvents.propertychange=2,Element.Events.change={base:function(){var t=this.type;return"input"!=this.get("tag")||"radio"!=t&&"checkbox"!=t?"change":"propertychange"},condition:function(t){return"propertychange"!=t.type||"checked"==t.event.propertyName}})}(),function(){this.Chain=new Class({$chain:[],chain:function(){return this.$chain.append(Array.flatten(arguments)),this},callChain:function(){return!!this.$chain.length&&this.$chain.shift().apply(this,arguments)},clearChain:function(){return this.$chain.empty(),this}});var t=function(t){return t.replace(/^on([A-Z])/,function(t,e){return e.toLowerCase()})};this.Events=new Class({$events:{},addEvent:function(e,n,r){return e=t(e),this.$events[e]=(this.$events[e]||[]).include(n),r&&(n.internal=!0),this},addEvents:function(t){for(var e in t)this.addEvent(e,t[e]);return this},fireEvent:function(e,n,r){e=t(e);var i=this.$events[e];return i?(n=Array.convert(n),i.each(function(t){r?t.delay(r,this,n):t.apply(this,n)},this),this):this},removeEvent:function(e,n){e=t(e);var r=this.$events[e];if(r&&!n.internal){var i=r.indexOf(n);-1!=i&&delete r[i]}return this},removeEvents:function(e){var n;if("object"==typeOf(e)){for(n in e)this.removeEvent(n,e[n]);return this}e&&(e=t(e));for(n in this.$events)if(!e||e==n)for(var r=this.$events[n],i=r.length;i--;)i in r&&this.removeEvent(n,r[i]);return this}}),this.Options=new Class({setOptions:function(){var t=this.options=Object.merge.apply(null,[{},this.options].append(arguments));if(this.addEvent)for(var e in t)"function"==typeOf(t[e])&&/^on[A-Z]/.test(e)&&(this.addEvent(e,t[e]),delete t[e]);return this}})}(),function(){function t(r,i){if(r.$thenableState===s)if(r===i)n(r,new TypeError("Tried to resolve a thenable with itself."));else if(!i||"object"!=typeof i&&"function"!=typeof i)e(r,i);else{var o;try{o=i.then}catch(t){n(r,t)}if("function"==typeof o){var a=!1;l(function(){try{o.call(i,function(e){a||(a=!0,t(r,e))},function(t){a||(a=!0,n(r,t))})}catch(t){a||(a=!0,n(r,t))}})}else e(r,i)}}function e(t,e){t.$thenableState===s&&(t.$thenableResult=e,t.$thenableState=a,i(t))}function n(t,e){t.$thenableState===s&&(t.$thenableResult=e,t.$thenableState=u,i(t))}function r(t){t.$thenableState!==s&&(t.$thenableResult=null,t.$thenableState=s)}function i(t){var e,n=t.$thenableState,r=t.$thenableResult,i=t.$thenableReactions;n===a?(t.$thenableReactions=[],e="fulfillHandler"):n==u&&(t.$thenableReactions=[],e="rejectHandler"),e&&l(o.pass([r,i,e]))}function o(e,r,i){for(var o=0,s=r.length;o<s;++o){var a=r[o],u=a[i];if("Identity"===u)t(a.thenable,e);else if("Thrower"===u)n(a.thenable,e);else try{t(a.thenable,u(e))}catch(t){n(a.thenable,t)}}}var s=0,a=1,u=2,c=Class.Thenable=new Class({$thenableState:s,$thenableResult:null,$thenableReactions:[],resolve:function(e){return t(this,e),this},reject:function(t){return n(this,t),this},getThenableState:function(){switch(this.$thenableState){case s:return"pending";case a:return"fulfilled";case u:return"rejected"}},resetThenable:function(t){return n(this,t),r(this),this},then:function(t,e){"function"!=typeof t&&(t="Identity"),"function"!=typeof e&&(e="Thrower");var n=new c;return this.$thenableReactions.push({thenable:n,fulfillHandler:t,rejectHandler:e}),this.$thenableState!==s&&i(this),n},catch:function(t){return this.then(null,t)}});c.extend({resolve:function(e){var n;return e instanceof c?n=e:(n=new c,t(n,e)),n},reject:function(t){var e=new c;return n(e,t),e}});var l;l="undefined"!=typeof process&&"function"==typeof process.nextTick?process.nextTick:"undefined"!=typeof setImmediate?setImmediate:function(t){setTimeout(t,0)}}(),function(){var t=this.Fx=new Class({Implements:[Chain,Events,Options,Class.Thenable],options:{fps:60,unit:!1,duration:500,frames:null,frameSkip:!0,link:"ignore"},initialize:function(t){this.subject=this.subject||this,this.setOptions(t)},getTransition:function(){return function(t){return-(Math.cos(Math.PI*t)-1)/2}},step:function(t){if(this.options.frameSkip){var e=null!=this.time?t-this.time:0,n=e/this.frameInterval;this.time=t,this.frame+=n}else this.frame++;if(this.frame<this.frames){var r=this.transition(this.frame/this.frames);this.set(this.compute(this.from,this.to,r))}else this.frame=this.frames,this.set(this.compute(this.from,this.to,1)),this.stop()},set:function(t){return t},compute:function(e,n,r){return t.compute(e,n,r)},check:function(){if(!this.isRunning())return!0;switch(this.options.link){case"cancel":return this.cancel(),!0;case"chain":return this.chain(this.caller.pass(arguments,this)),!1}return!1},start:function(e,n){if(!this.check(e,n))return this;this.from=e,this.to=n,this.frame=this.options.frameSkip?0:-1,this.time=null,this.transition=this.getTransition();var r=this.options.frames,o=this.options.fps,s=this.options.duration;return this.duration=t.Durations[s]||s.toInt(),this.frameInterval=1e3/o,this.frames=r||Math.round(this.duration/this.frameInterval),"pending"!==this.getThenableState()&&this.resetThenable(this.subject),this.fireEvent("start",this.subject),i.call(this,o),this},stop:function(){return this.isRunning()&&(this.time=null,o.call(this,this.options.fps),this.frames==this.frame?(this.fireEvent("complete",this.subject),this.callChain()||this.fireEvent("chainComplete",this.subject)):this.fireEvent("stop",this.subject),this.resolve(this.subject===this?null:this.subject)),this},cancel:function(){return this.isRunning()&&(this.time=null,o.call(this,this.options.fps),this.frame=this.frames,this.fireEvent("cancel",this.subject).clearChain(),this.reject(this.subject)),this},pause:function(){return this.isRunning()&&(this.time=null,o.call(this,this.options.fps)),this},resume:function(){return this.isPaused()&&i.call(this,this.options.fps),this},isRunning:function(){var t=e[this.options.fps];return t&&t.contains(this)},isPaused:function(){return this.frame<this.frames&&!this.isRunning()}});t.compute=function(t,e,n){return(e-t)*n+t},t.Durations={short:250,normal:500,long:1e3};var e={},n={},r=function(){for(var t=Date.now(),e=this.length;e--;){var n=this[e];n&&n.step(t)}},i=function(t){var i=e[t]||(e[t]=[]);i.push(this),n[t]||(n[t]=r.periodical(Math.round(1e3/t),i))},o=function(t){var r=e[t];r&&(r.erase(this),!r.length&&n[t]&&(delete e[t],n[t]=clearInterval(n[t])))}}(),function(){var t,e=document.html;t=document.createElement("div"),t.style.color="red",t.style.color=null;var n="red"==t.style.color;t.style.border="1px solid #123abc";var r="1px solid #123abc"!=t.style.border;t=null;var i=!!window.getComputedStyle,o=null!=document.createElement("div").style.borderRadius;Element.Properties.styles={set:function(t){this.setStyles(t)}};var s=null!=e.style.opacity,a=null!=e.style.filter,u=/alpha\(opacity=([\d.]+)\)/i,c=function(t,e){t.store("$opacity",e),t.style.visibility=e>0||null==e?"visible":"hidden"},l=function(t,e,n){var r=t.style,i=r.filter||t.getComputedStyle("filter")||"";r.filter=(e.test(i)?i.replace(e,n):i+" "+n).trim(),r.filter||r.removeAttribute("filter")},h=s?function(t,e){t.style.opacity=e}:a?function(t,e){t.currentStyle&&t.currentStyle.hasLayout||(t.style.zoom=1),null==e||1==e?(l(t,u,""),1==e&&1!=f(t)&&l(t,u,"alpha(opacity=100)")):l(t,u,"alpha(opacity="+(100*e).limit(0,100).round()+")")}:c,f=s?function(t){var e=t.style.opacity||t.getComputedStyle("opacity");return""==e?1:e.toFloat()}:a?function(t){var e,n=t.style.filter||t.getComputedStyle("filter");return n&&(e=n.match(u)),null==e||null==n?1:e[1]/100}:function(t){var e=t.retrieve("$opacity");return null==e&&(e="hidden"==t.style.visibility?0:1),e},p=null==e.style.cssFloat?"styleFloat":"cssFloat",d={left:"0%",top:"0%",center:"50%",right:"100%",bottom:"100%"},m=null!=e.style.backgroundPositionX,v=/^-(ms)-/,g=function(t){return t.replace(v,"$1-").camelCase()},y=function(t,e){"backgroundPosition"==e&&(t.removeAttribute(e+"X"),e+="Y"),t.removeAttribute(e)};Element.implement({getComputedStyle:function(t){if(!i&&this.currentStyle)return this.currentStyle[g(t)];var e=Element.getDocument(this).defaultView,n=e?e.getComputedStyle(this,null):null;return n?n.getPropertyValue(t==p?"float":t.hyphenate()):""},setStyle:function(t,e){if("opacity"==t)return null!=e&&(e=parseFloat(e)),h(this,e),this;if(t=g("float"==t?p:t),"string"!=typeOf(e)){var r=(Element.Styles[t]||"@").split(" ");e=Array.convert(e).map(function(t,e){return r[e]?"number"==typeOf(t)?r[e].replace("@",Math.round(t)):t:""}).join(" ")}else e==String(Number(e))&&(e=Math.round(e));return this.style[t]=e,(""==e||null==e)&&n&&this.style.removeAttribute&&y(this.style,t),this},getStyle:function(t){
if("opacity"==t)return f(this);if(t=g("float"==t?p:t),o&&-1!=t.indexOf("borderRadius"))return["borderTopLeftRadius","borderTopRightRadius","borderBottomRightRadius","borderBottomLeftRadius"].map(function(t){return this.style[t]||"0px"},this).join(" ");var e=this.style[t];if(!e||"zIndex"==t){if(Element.ShortStyles.hasOwnProperty(t)){e=[];for(var n in Element.ShortStyles[t])e.push(this.getStyle(n));return e.join(" ")}e=this.getComputedStyle(t)}if(m&&/^backgroundPosition[XY]?$/.test(t))return e.replace(/(top|right|bottom|left)/g,function(t){return d[t]})||"0px";if(!e&&"backgroundPosition"==t)return"0px 0px";if(e){e=String(e);var s=e.match(/rgba?\([\d\s,]+\)/);s&&(e=e.replace(s[0],s[0].rgbToHex()))}if(!i&&!this.style[t]){if(/^(height|width)$/.test(t)&&!/px$/.test(e)){var a="width"==t?["left","right"]:["top","bottom"],u=0;return a.each(function(t){u+=this.getStyle("border-"+t+"-width").toInt()+this.getStyle("padding-"+t).toInt()},this),this["offset"+t.capitalize()]-u+"px"}if(/^border(.+)Width|margin|padding/.test(t)&&isNaN(parseFloat(e)))return"0px"}return r&&/^border(Top|Right|Bottom|Left)?$/.test(t)&&/^#/.test(e)?e.replace(/^(.+)\s(.+)\s(.+)$/,"$2 $3 $1"):e},setStyles:function(t){for(var e in t)this.setStyle(e,t[e]);return this},getStyles:function(){var t={};return Array.flatten(arguments).each(function(e){t[e]=this.getStyle(e)},this),t}}),Element.Styles={left:"@px",top:"@px",bottom:"@px",right:"@px",width:"@px",height:"@px",maxWidth:"@px",maxHeight:"@px",minWidth:"@px",minHeight:"@px",backgroundColor:"rgb(@, @, @)",backgroundSize:"@px",backgroundPosition:"@px @px",color:"rgb(@, @, @)",fontSize:"@px",letterSpacing:"@px",lineHeight:"@px",clip:"rect(@px @px @px @px)",margin:"@px @px @px @px",padding:"@px @px @px @px",border:"@px @ rgb(@, @, @) @px @ rgb(@, @, @) @px @ rgb(@, @, @)",borderWidth:"@px @px @px @px",borderStyle:"@ @ @ @",borderColor:"rgb(@, @, @) rgb(@, @, @) rgb(@, @, @) rgb(@, @, @)",zIndex:"@",zoom:"@",fontWeight:"@",textIndent:"@px",opacity:"@",borderRadius:"@px @px @px @px"},Element.ShortStyles={margin:{},padding:{},border:{},borderWidth:{},borderStyle:{},borderColor:{}},["Top","Right","Bottom","Left"].each(function(t){var e=Element.ShortStyles,n=Element.Styles;["margin","padding"].each(function(r){var i=r+t;e[r][i]=n[i]="@px"});var r="border"+t;e.border[r]=n[r]="@px @ rgb(@, @, @)";var i=r+"Width",o=r+"Style",s=r+"Color";e[r]={},e.borderWidth[i]=e[r][i]=n[i]="@px",e.borderStyle[o]=e[r][o]=n[o]="@",e.borderColor[s]=e[r][s]=n[s]="rgb(@, @, @)"}),m&&(Element.ShortStyles.backgroundPosition={backgroundPositionX:"@",backgroundPositionY:"@"})}(),Fx.CSS=new Class({Extends:Fx,prepare:function(t,e,n){n=Array.convert(n);var r=n[0],i=n[1];if(null==i){i=r,r=t.getStyle(e);var o=this.options.unit;if(o&&r&&"string"==typeof r&&r.slice(-o.length)!=o&&0!=parseFloat(r)){t.setStyle(e,i+o);var s=t.getComputedStyle(e);if(!/px$/.test(s)&&null==(s=t.style[("pixel-"+e).camelCase()])){var a=t.style.left;t.style.left=i+o,s=t.style.pixelLeft,t.style.left=a}r=(i||1)/(parseFloat(s)||1)*(parseFloat(r)||0),t.setStyle(e,r+o)}}return{from:this.parse(r),to:this.parse(i)}},parse:function(t){return t=Function.convert(t)(),t="string"==typeof t?t.split(" "):Array.convert(t),t.map(function(t){t=String(t);var e=!1;return Object.each(Fx.CSS.Parsers,function(n){if(!e){var r=n.parse(t);(r||0===r)&&(e={value:r,parser:n})}}),e=e||{value:t,parser:Fx.CSS.Parsers.String}})},compute:function(t,e,n){var r=[];return Math.min(t.length,e.length).times(function(i){r.push({value:t[i].parser.compute(t[i].value,e[i].value,n),parser:t[i].parser})}),r.$family=Function.convert("fx:css:value"),r},serve:function(t,e){"fx:css:value"!=typeOf(t)&&(t=this.parse(t));var n=[];return t.each(function(t){n=n.concat(t.parser.serve(t.value,e))}),n},render:function(t,e,n,r){t.setStyle(e,this.serve(n,r))},search:function(t){if(Fx.CSS.Cache[t])return Fx.CSS.Cache[t];var e={},n=new RegExp("^"+t.escapeRegExp()+"$"),r=function(t){Array.each(t,function(t){if(t.media)return void r(t.rules||t.cssRules);if(t.style){var i=t.selectorText?t.selectorText.replace(/^\w+/,function(t){return t.toLowerCase()}):null;i&&n.test(i)&&Object.each(Element.Styles,function(n,r){t.style[r]&&!Element.ShortStyles[r]&&(n=String(t.style[r]),e[r]=/^rgb/.test(n)?n.rgbToHex():n)})}})};return Array.each(document.styleSheets,function(t){var e=t.href;if(!(e&&e.indexOf("://")>-1&&-1==e.indexOf(document.domain))){var n=t.rules||t.cssRules;r(n)}}),Fx.CSS.Cache[t]=e}}),Fx.CSS.Cache={},Fx.CSS.Parsers={Color:{parse:function(t){return t.match(/^#[0-9a-f]{3,6}$/i)?t.hexToRgb(!0):!!(t=t.match(/(\d+),\s*(\d+),\s*(\d+)/))&&[t[1],t[2],t[3]]},compute:function(t,e,n){return t.map(function(r,i){return Math.round(Fx.compute(t[i],e[i],n))})},serve:function(t){return t.map(Number)}},Number:{parse:parseFloat,compute:Fx.compute,serve:function(t,e){return e?t+e:t}},String:{parse:Function.convert(!1),compute:function(t,e){return e},serve:function(t){return t}}};
/**
sprintf() for JavaScript 0.7-beta1
http://www.diveintojavascript.com/projects/javascript-sprintf

Copyright (c) Alexandru Marasteanu <alexaholic [at) gmail (dot] com>
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of sprintf() for JavaScript nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL Alexandru Marasteanu BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.


Changelog:
2010.09.06 - 0.7-beta1
  - features: vsprintf, support for named placeholders
  - enhancements: format cache, reduced global namespace pollution

2010.05.22 - 0.6:
 - reverted to 0.4 and fixed the bug regarding the sign of the number 0
 Note:
 Thanks to Raphael Pigulla <raph (at] n3rd [dot) org> (http://www.n3rd.org/)
 who warned me about a bug in 0.5, I discovered that the last update was
 a regress. I appologize for that.

2010.05.09 - 0.5:
 - bug fix: 0 is now preceeded with a + sign
 - bug fix: the sign was not at the right position on padded results (Kamal Abdali)
 - switched from GPL to BSD license

2007.10.21 - 0.4:
 - unit test and patch (David Baird)

2007.09.17 - 0.3:
 - bug fix: no longer throws exception on empty paramenters (Hans Pufal)

2007.09.11 - 0.2:
 - feature: added argument swapping

2007.04.03 - 0.1:
 - initial release
**/

var sprintf = (function() {
    function get_type(variable) {
        return Object.prototype.toString.call(variable).slice(8, -1).toLowerCase();
    }
    function str_repeat(input, multiplier) {
        for (var output = []; multiplier > 0; output[--multiplier] = input) {/* do nothing */}
        return output.join('');
    }

    var str_format = function() {
        if (!str_format.cache.hasOwnProperty(arguments[0])) {
            str_format.cache[arguments[0]] = str_format.parse(arguments[0]);
        }
        return str_format.format.call(null, str_format.cache[arguments[0]], arguments);
    };

    str_format.format = function(parse_tree, argv) {
        var cursor = 1, tree_length = parse_tree.length, node_type = '', arg, output = [], i, k, match, pad, pad_character, pad_length;
        for (i = 0; i < tree_length; i++) {
            node_type = get_type(parse_tree[i]);
            if (node_type === 'string') {
                output.push(parse_tree[i]);
            }
            else if (node_type === 'array') {
                match = parse_tree[i]; // convenience purposes only
                if (match[2]) { // keyword argument
                    arg = argv[cursor];
                    for (k = 0; k < match[2].length; k++) {
                        if (!arg.hasOwnProperty(match[2][k])) {
                            throw(sprintf('[sprintf] property "%s" does not exist', match[2][k]));
                        }
                        arg = arg[match[2][k]];
                    }
                }
                else if (match[1]) { // positional argument (explicit)
                    arg = argv[match[1]];
                }
                else { // positional argument (implicit)
                    arg = argv[cursor++];
                }

                if (/[^s]/.test(match[8]) && (get_type(arg) != 'number')) {
                    throw(sprintf('[sprintf] expecting number but found %s', get_type(arg)));
                }
                switch (match[8]) {
                    case 'b': arg = arg.toString(2); break;
                    case 'c': arg = String.fromCharCode(arg); break;
                    case 'd': arg = parseInt(arg, 10); break;
                    case 'e': arg = match[7] ? arg.toExponential(match[7]) : arg.toExponential(); break;
                    case 'f': arg = match[7] ? parseFloat(arg).toFixed(match[7]) : parseFloat(arg); break;
                    case 'o': arg = arg.toString(8); break;
                    case 's': arg = ((arg = String(arg)) && match[7] ? arg.substring(0, match[7]) : arg); break;
                    case 'u': arg = Math.abs(arg); break;
                    case 'x': arg = arg.toString(16); break;
                    case 'X': arg = arg.toString(16).toUpperCase(); break;
                }
                arg = (/[def]/.test(match[8]) && match[3] && arg >= 0 ? '+'+ arg : arg);
                pad_character = match[4] ? match[4] == '0' ? '0' : match[4].charAt(1) : ' ';
                pad_length = match[6] - String(arg).length;
                pad = match[6] ? str_repeat(pad_character, pad_length) : '';
                output.push(match[5] ? arg + pad : pad + arg);
            }
        }
        return output.join('');
    };

    str_format.cache = {};

    str_format.parse = function(fmt) {
        var _fmt = fmt, match = [], parse_tree = [], arg_names = 0;
        while (_fmt) {
            if ((match = /^[^\x25]+/.exec(_fmt)) !== null) {
                parse_tree.push(match[0]);
            }
            else if ((match = /^\x25{2}/.exec(_fmt)) !== null) {
                parse_tree.push('%');
            }
            else if ((match = /^\x25(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-fosuxX])/.exec(_fmt)) !== null) {
                if (match[2]) {
                    arg_names |= 1;
                    var field_list = [], replacement_field = match[2], field_match = [];
                    if ((field_match = /^([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
                        field_list.push(field_match[1]);
                        while ((replacement_field = replacement_field.substring(field_match[0].length)) !== '') {
                            if ((field_match = /^\.([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
                                field_list.push(field_match[1]);
                            }
                            else if ((field_match = /^\[(\d+)\]/.exec(replacement_field)) !== null) {
                                field_list.push(field_match[1]);
                            }
                            else {
                                throw('[sprintf] huh?');
                            }
                        }
                    }
                    else {
                        throw('[sprintf] huh?');
                    }
                    match[2] = field_list;
                }
                else {
                    arg_names |= 2;
                }
                if (arg_names === 3) {
                    throw('[sprintf] mixing positional and named placeholders is not (yet) supported');
                }
                parse_tree.push(match);
            }
            else {
                throw('[sprintf] huh?');
            }
            _fmt = _fmt.substring(match[0].length);
        }
        return parse_tree;
    };

    return str_format;
})();

var vsprintf = function(fmt, argv) {
    argv.unshift(fmt);
    return sprintf.apply(null, argv);
};


//
//  BVTouchable.js
//  ExplorableExplanations
//
//  Created by Bret Victor on 3/10/11.
//  (c) 2011 Bret Victor.  MIT open-source license.
//

(function () {

var BVTouchable = this.BVTouchable = new Class ({

    initialize: function (el, delegate) {
        this.element = el;
        this.delegate = delegate;
        this.setTouchable(true);
    },


    //----------------------------------------------------------------------------------
    //
    //  touches
    //

    setTouchable: function (isTouchable) {
        if (this.touchable === isTouchable) { return; }
        this.touchable = isTouchable;
        this.element.style.pointerEvents = (this.touchable || this.hoverable) ? "auto" : "none";

        if (isTouchable) {
            if (!this._mouseBound) {
                this._mouseBound = {
                    mouseDown: this._mouseDown.bind(this),
                    mouseMove: this._mouseMove.bind(this),
                    mouseUp: this._mouseUp.bind(this),
                    touchStart: this._touchStart.bind(this),
                    touchMove: this._touchMove.bind(this),
                    touchEnd: this._touchEnd.bind(this),
                    touchCancel: this._touchCancel.bind(this)
                };
            }
            this.element.addEvent("mousedown", this._mouseBound.mouseDown);
            this.element.addEvent("touchstart", this._mouseBound.touchStart);
        }
        else {
            this.element.removeEvents("mousedown");
            this.element.removeEvents("touchstart");
        }
    },

    touchDidGoDown: function (touches) { this.delegate.touchDidGoDown(touches); },
    touchDidMove: function (touches) { this.delegate.touchDidMove(touches);  },
    touchDidGoUp: function (touches) { this.delegate.touchDidGoUp(touches);  },

    _mouseDown: function (event) {
        event.stop();
        this.element.getDocument().addEvents({
            mousemove: this._mouseBound.mouseMove,
            mouseup: this._mouseBound.mouseUp
        });

        this.touches = new BVTouches(event);
        this.touchDidGoDown(this.touches);
    },

    _mouseMove: function (event) {
        event.stop();
        this.touches._updateWithEvent(event);
        this.touchDidMove(this.touches);
    },

    _mouseUp: function (event) {
        event.stop();
        this.touches._goUpWithEvent(event);
        this.touchDidGoUp(this.touches);

        delete this.touches;
        this.element.getDocument().removeEvents({
            mousemove: this._mouseBound.mouseMove,
            mouseup: this._mouseBound.mouseUp
        });
    },

    _touchStart: function (event) {
        event.stop();
        if (this.touches || event.length > 1) { this._touchCancel(event); return; }  // only-single touch for now

        this.element.getDocument().addEvents({
            touchmove: this._mouseBound.touchMove,
            touchend: this._mouseBound.touchEnd,
            touchcancel: this._mouseBound.touchCancel
        });

        this.touches = new BVTouches(event);
        this.touchDidGoDown(this.touches);
    },

    _touchMove: function (event) {
        event.stop();
        if (!this.touches) { return; }

        this.touches._updateWithEvent(event);
        this.touchDidMove(this.touches);
    },

    _touchEnd: function (event) {
        event.stop();
        if (!this.touches) { return; }

        this.touches._goUpWithEvent(event);
        this.touchDidGoUp(this.touches);

        delete this.touches;
        this.element.getDocument().removeEvents({
            touchmove: this._mouseBound.touchMove,
            touchend: this._mouseBound.touchEnd,
            touchcancel: this._mouseBound.touchCancel
        });
    },

    _touchCancel: function (event) {
        this._touchEnd(event);
    }

});


//====================================================================================
//
//  BVTouches
//

var BVTouches = this.BVTouches = new Class({

    initialize: function (event) {
        this.globalPoint = { x:event.page.x, y:-event.page.y };
        this.translation = { x:0, y:0 };
        this.deltaTranslation = { x:0, y:0 };
        this.velocity = { x:0, y:0 };
        this.count = 1;
        this.event = event;
        this.timestamp = event.event.timeStamp;
        this.downTimestamp = this.timestamp;
    },

    _updateWithEvent: function (event, isRemoving) {
        this.event = event;
        if (!isRemoving) {
            var dx = event.page.x - this.globalPoint.x;  // todo, transform to local coordinate space?
            var dy = -event.page.y - this.globalPoint.y;
            this.translation.x += dx;
            this.translation.y += dy;
            this.deltaTranslation.x += dx;
            this.deltaTranslation.y += dy;
            this.globalPoint.x = event.page.x;
            this.globalPoint.y = -event.page.y;
        }

        var timestamp = event.event.timeStamp;
        var dt = timestamp - this.timestamp;
        var isSamePoint = isRemoving || (dx === 0 && dy === 0);
        var isStopped = (isSamePoint && dt > 150);

        this.velocity.x = isStopped ? 0 : (isSamePoint || dt === 0) ? this.velocity.x : (dx / dt * 1000);
        this.velocity.y = isStopped ? 0 : (isSamePoint || dt === 0) ? this.velocity.y : (dy / dt * 1000);
        this.timestamp = timestamp;
    },

    _goUpWithEvent: function (event) {
        this._updateWithEvent(event, true);
        this.count = 0;

        var didMove = Math.abs(this.translation.x) > 10 || Math.abs(this.translation.y) > 10;
        var wasMoving = Math.abs(this.velocity.x) > 400 || Math.abs(this.velocity.y) > 400;
        this.wasTap = !didMove && !wasMoving && (this.getTimeSinceGoingDown() < 300);
    },

    getTimeSinceGoingDown: function () {
        return this.timestamp - this.downTimestamp;
    },

    resetDeltaTranslation: function () {
        this.deltaTranslation.x = 0;
        this.deltaTranslation.y = 0;
    }

});


//====================================================================================

})();


//
//  TangleKit.js
//  Tangle 0.1.0
//
//  Created by Bret Victor on 6/10/11.
//  (c) 2011 Bret Victor.  MIT open-source license.
//


(function () {


//----------------------------------------------------------
//
//  TKIf
//
//  Shows the element if value is true (non-zero), hides if false.
//
//  Attributes:  data-invert (optional):  show if false instead.

Tangle.classes.TKIf = {

    initialize: function (element, options, tangle, variable) {
        this.isInverted = !!options.invert;
    },

    update: function (element, value) {
        if (this.isInverted) { value = !value; }
        if (value) { element.style.removeProperty("display"); }
        else { element.style.display = "none" };
    }
};


//----------------------------------------------------------
//
//  TKSwitch
//
//  Shows the element's nth child if value is n.
//
//  False or true values will show the first or second child respectively.

Tangle.classes.TKSwitch = {

    update: function (element, value) {
        element.getChildren().each( function (child, index) {
            if (index != value) { child.style.display = "none"; }
            else { child.style.removeProperty("display"); }
        });
    }
};


//----------------------------------------------------------
//
//  TKSwitchPositiveNegative
//
//  Shows the element's first child if value is positive or zero.
//  Shows the element's second child if value is negative.

Tangle.classes.TKSwitchPositiveNegative = {

    update: function (element, value) {
        Tangle.classes.TKSwitch.update(element, value < 0);
    }
};


//----------------------------------------------------------
//
//  TKToggle
//
//  Click to toggle value between 0 and 1.

Tangle.classes.TKToggle = {

    initialize: function (element, options, tangle, variable) {
        element.addEvent("click", function (event) {
            var isActive = tangle.getValue(variable);
            tangle.setValue(variable, isActive ? 0 : 1);
        });
    }
};


//----------------------------------------------------------
//
//  TKNumberField
//
//  An input box where a number can be typed in.
//
//  Attributes:  data-size (optional): width of the box in characters

Tangle.classes.TKNumberField = {

    initialize: function (element, options, tangle, variable) {
        this.input = new Element("input", {
            type: "text",
            "class":"TKNumberFieldInput",
            size: options.size || 6
        }).inject(element, "top");

        var inputChanged = (function () {
            var value = this.getValue();
            tangle.setValue(variable, value);
        }).bind(this);

        this.input.addEvent("keyup",  inputChanged);
        this.input.addEvent("blur",   inputChanged);
        this.input.addEvent("change", inputChanged);
    },

    getValue: function () {
        var value = parseFloat(this.input.get("value"));
        return isNaN(value) ? 0 : value;
    },

    update: function (element, value) {
        var currentValue = this.getValue();
        if (value !== currentValue) { this.input.set("value", "" + value); }
    }
};


//----------------------------------------------------------
//
//  TKAdjustableNumber
//
//  Drag a number to adjust.
//
//  Attributes:  data-min (optional): minimum value
//               data-max (optional): maximum value
//               data-step (optional): granularity of adjustment (can be fractional)

var isAnyAdjustableNumberDragging = false;  // hack for dragging one value over another one

Tangle.classes.TKAdjustableNumber = {

    initialize: function (element, options, tangle, variable) {
        this.element = element;
        this.tangle = tangle;
        this.variable = variable;

        this.min = (options.min !== undefined) ? parseFloat(options.min) : 0;
        this.max = (options.max !== undefined) ? parseFloat(options.max) : 1e100;
        this.step = (options.step !== undefined) ? parseFloat(options.step) : 1;

        this.initializeHover();
        this.initializeHelp();
        this.initializeDrag();
    },


    // hover

    initializeHover: function () {
        this.isHovering = false;
        this.element.addEvent("mouseenter", (function () { this.isHovering = true;  this.updateRolloverEffects(); }).bind(this));
        this.element.addEvent("mouseleave", (function () { this.isHovering = false; this.updateRolloverEffects(); }).bind(this));
    },

    updateRolloverEffects: function () {
        this.updateStyle();
        this.updateCursor();
        this.updateHelp();
    },

    isActive: function () {
        return this.isDragging || (this.isHovering && !isAnyAdjustableNumberDragging);
    },

    updateStyle: function () {
        if (this.isDragging) { this.element.addClass("TKAdjustableNumberDown"); }
        else { this.element.removeClass("TKAdjustableNumberDown"); }

        if (!this.isDragging && this.isActive()) { this.element.addClass("TKAdjustableNumberHover"); }
        else { this.element.removeClass("TKAdjustableNumberHover"); }
    },

    updateCursor: function () {
        var body = document.getElement("body");
        if (this.isActive()) { body.addClass("TKCursorDragHorizontal"); }
        else { body.removeClass("TKCursorDragHorizontal"); }
    },


    // help

    initializeHelp: function () {
        this.helpElement = (new Element("div", { "class": "TKAdjustableNumberHelp" })).inject(this.element, "top");
        this.helpElement.setStyle("display", "none");
        this.helpElement.set("text", "drag");
    },

    updateHelp: function () {
        var size = {x: this.element.offsetWidth, y: this.element.offsetHeight};
        var top = -size.y + 7;
        var left = Math.round(0.5 * (size.x - 20));
        var display = (this.isHovering && !isAnyAdjustableNumberDragging) ? "block" : "none";
        this.helpElement.setStyles({ left:left, top:top, display:display });
    },


    // drag

    initializeDrag: function () {
        this.isDragging = false;
        new BVTouchable(this.element, this);
    },

    touchDidGoDown: function (touches) {
        this.valueAtMouseDown = this.tangle.getValue(this.variable);
        this.isDragging = true;
        isAnyAdjustableNumberDragging = true;
        this.updateRolloverEffects();
        this.updateStyle();
    },

    touchDidMove: function (touches) {
        var value = this.valueAtMouseDown + touches.translation.x / 5 * this.step;
        value = ((value / this.step).round() * this.step).limit(this.min, this.max);
        this.tangle.setValue(this.variable, value);
        this.updateHelp();
    },

    touchDidGoUp: function (touches) {
        this.isDragging = false;
        isAnyAdjustableNumberDragging = false;
        this.updateRolloverEffects();
        this.updateStyle();
        this.helpElement.setStyle("display", touches.wasTap ? "block" : "none");
    }
};




//----------------------------------------------------------
//
//  formats
//
//  Most of these are left over from older versions of Tangle,
//  before parameters and printf were available.  They should
//  be redesigned.
//

function formatValueWithPrecision (value,precision) {
    if (Math.abs(value) >= 100) { precision--; }
    if (Math.abs(value) >= 10) { precision--; }
    return "" + value.round(Math.max(precision,0));
}

Tangle.formats.p3 = function (value) {
    return formatValueWithPrecision(value,3);
};

Tangle.formats.neg_p3 = function (value) {
    return formatValueWithPrecision(-value,3);
};

Tangle.formats.p2 = function (value) {
    return formatValueWithPrecision(value,2);
};

Tangle.formats.e6 = function (value) {
    return "" + (value * 1e-6).round();
};

Tangle.formats.abs_e6 = function (value) {
    return "" + (Math.abs(value) * 1e-6).round();
};

Tangle.formats.freq = function (value) {
    if (value < 100) { return "" + value.round(1) + " Hz"; }
    if (value < 1000) { return "" + value.round(0) + " Hz"; }
    return "" + (value / 1000).round(2) + " KHz";
};

Tangle.formats.dollars = function (value) {
    return "$" + value.round(0);
};

Tangle.formats.free = function (value) {
    return value ? ("$" + value.round(0)) : "free";
};

Tangle.formats.percent = function (value) {
    return "" + (100 * value).round(0) + "%";
};



//----------------------------------------------------------

})();

