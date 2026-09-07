(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){"use strict";var ready=require('domready'),menu=require('./menu'),offcanvas=require('./offcanvas'),totop=require('./totop'),$=require('./utils/dollar-extras'),instances={};ready(function(){instances={offcanvas:new offcanvas(),menu:new menu(),$:$,ready:ready};module.exports=window.G5=instances;});module.exports=window.G5=instances;},{"./menu":2,"./offcanvas":3,"./totop":4,"./utils/dollar-extras":6,"domready":7}],2:[function(require,module,exports){(function(global){(function(){"use strict";var ready=require('domready'),prime=require('prime'),$=require('../utils/dollar-extras'),zen=require('elements/zen'),bind=require('mout/function/bind'),timeout=require('mout/function/timeout'),Bound=require('prime-util/prime/bound'),Options=require('prime-util/prime/options');var hasTouchEvents=('ontouchstart'in window)||window.DocumentTouch&&document instanceof DocumentTouch;var Menu=new prime({mixin:[Bound,Options],options:{selectors:{mainContainer:'.g-main-nav',mobileContainer:'#g-mobilemenu-container',topLevel:'.g-toplevel',rootItems:'> ul > li',parent:'.g-parent',item:'.g-menu-item',dropdown:'.g-dropdown',overlay:'.g-menu-overlay',touchIndicator:'.g-menu-parent-indicator',linkedParent:'[data-g-menuparent]',mobileTarget:'[data-g-mobile-target]'},states:{active:'g-active',inactive:'g-inactive',selected:'g-selected',touchEvents:'g-menu-hastouch'}},constructor:function(options){this.setOptions(options);this.selectors=this.options.selectors;this.states=this.options.states;this.overlay=zen('div'+this.selectors.overlay);this.active=null;this.location=[];var pageSurround=$('#g-page-surround');if(pageSurround){this.overlay.top(pageSurround);}var mainContainer=$(this.selectors.mainContainer);if(!mainContainer){return;}var gHoverExpand=mainContainer.data('g-hover-expand');this.hoverExpand=gHoverExpand===null||gHoverExpand==='true';if(hasTouchEvents||!this.hoverExpand){mainContainer.addClass(this.states.touchEvents);}this.attach();},attach:function(){var selectors=this.selectors,main=$(selectors.mainContainer+' '+selectors.item),mobileContainer=$(selectors.mobileContainer),body=$('body');if(!main){return;}if(this.hoverExpand){main.on('mouseenter',this.bound('mouseenter'));main.on('mouseleave',this.bound('mouseleave'));}body.delegate('click',':not('+selectors.mainContainer+') '+selectors.linkedParent+', .g-fullwidth .g-sublevel '+selectors.linkedParent,this.bound('click'));body.delegate('click',':not('+selectors.mainContainer+') a[href]',this.bound('resetAfterClick'));if(hasTouchEvents||!this.hoverExpand){var linkedParent=$(selectors.linkedParent);if(linkedParent){linkedParent.on('touchmove',this.bound('touchmove'));linkedParent.on('touchend',this.bound('touchend'));}this.overlay.on('touchend',this.bound('closeAllDropdowns'));}if(mobileContainer){var query='only all and (max-width: '+this._calculateBreakpoint((mobileContainer.data('g-menu-breakpoint')||'48rem'))+')',match=matchMedia(query);match.addListener(this.bound('_checkQuery'));this._checkQuery(match);}},detach:function(){},click:function(event){this.touchend(event);},resetAfterClick:function(event){var target=$(event.target);if(target.data('g-menuparent')!==null){return true;}this.closeDropdown(event);if(global.G5&&global.G5.offcanvas){G5.offcanvas.close();}},mouseenter:function(event){var element=$(event.target);if(!element.parent(this.options.selectors.mainContainer)){return;}if(element.parent(this.options.selectors.item)&&!element.parent('.g-standard')){return;}this.openDropdown(element);},mouseleave:function(event){var element=$(event.target);if(!element.parent(this.options.selectors.mainContainer)){return;}if(element.parent(this.options.selectors.item)&&!element.parent('.g-standard')){return;}this.closeDropdown(element);},touchmove:function(event){var target=$(event.target);target.isMoving=true;},touchend:function(event){var selectors=this.selectors,states=this.states;var target=$(event.target),indicator=target.parent(selectors.item).find(selectors.touchIndicator),menuType=target.parent('.g-standard')?'standard':'megamenu',isGoingBack=target.parent('.g-go-back'),parent,isSelected;if(target.isMoving){target.isMoving=false;return false;}target.off('touchmove',this.bound('touchmove'));target.isMoving=false;if(indicator){target=indicator;}parent=target.matches(selectors.item)?target:target.parent(selectors.item);isSelected=parent.hasClass(states.selected);if(!parent.find(selectors.dropdown)&&!indicator){return true;}event.stopPropagation();if(!indicator||target.matches(selectors.touchIndicator)){event.preventDefault();}if(!isSelected){var siblings=parent.siblings();if(siblings){var currentlyOpen=siblings.search(selectors.touchIndicator+' !> * !> '+selectors.item+'.'+states.selected);(currentlyOpen||[]).forEach(bind(function(open){this.closeDropdown(open);},this));}}if((menuType=='megamenu'||!parent.parent(selectors.mainContainer))&&(parent.find(' > '+selectors.dropdown+', > * > '+selectors.dropdown)||isGoingBack)){var sublevel=target.parent('.g-sublevel')||target.parent('.g-toplevel'),slideout=parent.find('.g-sublevel'),columns=parent.parent('.g-dropdown-column'),blocks;if(sublevel){var isNavMenu=target.parent(selectors.mainContainer);if(!isNavMenu||(isNavMenu&&!sublevel.matches('.g-toplevel'))){this._fixHeights(sublevel,slideout,isGoingBack,isNavMenu);}if(!isNavMenu&&columns&&(blocks=columns.search('> .g-grid > .g-block'))){if(blocks.length>1){sublevel=blocks.search('> .g-sublevel');}}sublevel[!isSelected?'addClass':'removeClass']('g-slide-out');}}this[!isSelected?'openDropdown':'closeDropdown'](parent);if(event.type!=='click'){this.toggleOverlay(target.parent(selectors.mainContainer));}},openDropdown:function(element){element=$(element.target||element);var dropdown=element.find(this.selectors.dropdown);element.addClass(this.states.selected);if(dropdown){dropdown.removeClass(this.states.inactive).addClass(this.states.active);}},closeDropdown:function(element){element=$(element.target||element);var dropdown=element.find(this.selectors.dropdown);element.removeClass(this.states.selected);if(dropdown){var sublevels=dropdown.search('.g-sublevel'),slideouts=dropdown.search('.g-slide-out, .'+this.states.selected),actives=dropdown.search('.'+this.states.active);if(sublevels){sublevels.attribute('style',null);}if(slideouts){slideouts.removeClass('g-slide-out').removeClass(this.states.selected);}if(actives){actives.removeClass(this.states.active).addClass(this.states.inactive);}dropdown.removeClass(this.states.active).addClass(this.states.inactive);}},closeAllDropdowns:function(){var selectors=this.selectors,states=this.states,topLevel=$(selectors.mainContainer+' > .g-toplevel'),roots=topLevel.search(' >'+selectors.item);if(roots){roots.removeClass(states.selected);}if(topLevel){var allRoots=topLevel.search('> '+this.options.selectors.item);if(allRoots){allRoots.forEach(this.closeDropdown.bind(this));}this.closeDropdown(topLevel);}this.toggleOverlay(topLevel);},resetStates:function(menu){if(!menu){return;}var items=menu.search('.g-toplevel, .g-dropdown-column, .g-dropdown, .g-selected, .g-active, .g-slide-out'),actives=menu.search('.g-active');if(!items){return;}menu.attribute('style',null).removeClass('g-selected').removeClass('g-slide-out');items.attribute('style',null).removeClass('g-selected').removeClass('g-slide-out');if(actives){actives.removeClass('g-active').addClass('g-inactive');}},toggleOverlay:function(menu){if(!menu){return;}var shouldOpen=!!menu.find('.g-active, .g-selected');this.overlay[shouldOpen?'addClass':'removeClass']('g-menu-overlay-open');this.overlay[0].style.opacity=shouldOpen?1:0;},_fixHeights:function(parent,sublevel,isGoingBack,isNavMenu){if(parent==sublevel){return;}if(isGoingBack){parent.attribute('style',null);}var parents,heights={from:parent[0].getBoundingClientRect(),to:(!isNavMenu?sublevel.parent('.g-dropdown')[0]:sublevel[0]).getBoundingClientRect()},height=Math.max(heights.from.height,heights.to.height);if(isGoingBack){parents=parent.parents('[style^="height"]');(parents||[]).forEach(function(element){element=$(element);if(element.parent('.g-toplevel')){element[0].style.height=heights.from.height+'px';}});}if(!isGoingBack){if(heights.from.height<heights.to.height){parent[0].style.height=height+'px';parents=parent.parents('[style^="height"]');(parents||[]).forEach(function(element){element=$(element);if(element.parent('.g-toplevel')){element[0].style.height=height+'px';}});}else if(isNavMenu){sublevel[0].style.height=height+'px';}if(!isNavMenu){var maxHeight=height,block=$(sublevel).parent('.g-block:not(.size-100)'),column=block?block.parent('.g-dropdown-column'):null;(sublevel.parents('.g-slide-out, .g-dropdown-column')||parent).forEach(function(slideout){maxHeight=Math.max(height,parseInt(slideout.style.height||0,10));});if(column){column[0].style.height=maxHeight+'px';var blocks=column.search('> .g-grid > .g-block'),diff=maxHeight;blocks.forEach(function(block,i){if((i+1)!=blocks.length){diff-=block.getBoundingClientRect().height;}else{$(block).find('.g-sublevel')[0].style.height=diff+'px';}});}else{sublevel[0].style.height=maxHeight+'px';}}}},_calculateBreakpoint:function(value){var digit=parseFloat(value.match(/^\d{1,}/).shift()),unit=value.match(/[a-z]{1,}$/i).shift(),tolerance=unit.match(/r?em/)?-0.062:-1;return(digit+tolerance)+unit;},_checkQuery:function(mq){var selectors=this.options.selectors,mobileContainer=$(selectors.mobileContainer),mainContainer=$(selectors.mainContainer+selectors.mobileTarget)||$(selectors.mainContainer),find,dropdowns;if(mq.matches){find=mainContainer.find(selectors.topLevel);if(find){mainContainer.parent('.g-block').addClass('hidden');mobileContainer.parent('.g-block').removeClass('hidden');find.top(mobileContainer);}}else{find=mobileContainer.find(selectors.topLevel);if(find){mobileContainer.parent('.g-block').addClass('hidden');mainContainer.parent('.g-block').removeClass('hidden');find.top(mainContainer);}}this.resetStates(find);if(!mq.matches&&(find&&(dropdowns=find.search('[data-g-item-width]')))){dropdowns.forEach(function(dropdown){dropdown=$(dropdown);dropdown[0].style.width=dropdown.data('g-item-width');});}},_debug:function(){}});module.exports=Menu;}).call(this)}).call(this,typeof global!=="undefined"?global:typeof self!=="undefined"?self:typeof window!=="undefined"?window:{})},{"../utils/dollar-extras":6,"domready":7,"elements/zen":36,"mout/function/bind":40,"mout/function/timeout":44,"prime":85,"prime-util/prime/bound":81,"prime-util/prime/options":82}],3:[function(require,module,exports){"use strict";var ready=require('domready'),prime=require('prime'),bind=require('mout/function/bind'),forEach=require('mout/array/forEach'),mapNumber=require('mout/math/map'),clamp=require('mout/math/clamp'),timeout=require('mout/function/timeout'),trim=require('mout/string/trim'),decouple=require('../utils/decouple'),Bound=require('prime-util/prime/bound'),Options=require('prime-util/prime/options'),$=require('elements'),zen=require('elements/zen');var prefix=(function(){var styles=window.getComputedStyle(document.documentElement,''),pre=(Array.prototype.slice.call(styles).join('').match(/-(moz|webkit|ms)-/)||(styles.OLink===''&&['','o']))[1],dom=('WebKit|Moz|MS|O').match(new RegExp('('+pre+')','i'))[1];return{dom:dom,lowercase:pre,css:'-'+pre+'-',js:pre[0].toUpperCase()+pre.substr(1)};})();var hasTouchEvents=('ontouchstart'in window)||window.DocumentTouch&&document instanceof DocumentTouch,isScrolling=false,scrollTimeout;var Offcanvas=new prime({mixin:[Bound,Options],options:{effect:'ease',duration:300,tolerance:function(padding){return padding/3;},padding:0,touch:true,css3:true,openClass:'g-offcanvas-open',openingClass:'g-offcanvas-opening',closingClass:'g-offcanvas-closing',overlayClass:'g-nav-overlay'},constructor:function(options){this.setOptions(options);this.attached=false;this.opening=false;this.moved=false;this.dragging=false;this.opened=false;this.preventOpen=false;this.offset={x:{start:0,current:0},y:{start:0,current:0}};this.bodyEl=$('body');this.htmlEl=$('html');this.panel=$('#g-page-surround');this.offcanvas=$('#g-offcanvas');if(!this.panel||!this.offcanvas){return false;}var swipe=this.offcanvas.data('g-offcanvas-swipe'),css3=this.offcanvas.data('g-offcanvas-css3');this.setOptions({touch:!!(swipe!==null?parseInt(swipe):1),css3:!!(css3!==null?parseInt(css3):1)});if(!this.options.padding){this.offcanvas[0].style.display='block';var width=this.offcanvas[0].getBoundingClientRect().width;this.offcanvas[0].style.removeProperty('display');this.setOptions({padding:width});}this.tolerance=typeof this.options.tolerance=='function'?this.options.tolerance.call(this,this.options.padding):this.options.tolerance;this.htmlEl.addClass('g-offcanvas-'+(this.options.css3?'css3':'css2'));this.attach();this._checkTogglers();return this;},attach:function(){this.attached=true;if(this.options.touch&&hasTouchEvents){this.attachTouchEvents();}forEach(['toggle','open','close'],bind(function(mode){this.bodyEl.delegate('click','[data-offcanvas-'+mode+']',this.bound(mode));if(hasTouchEvents){this.bodyEl.delegate('touchend','[data-offcanvas-'+mode+']',this.bound(mode));}},this));this.attachMutationEvent();this.overlay=zen('div[data-offcanvas-close].'+this.options.overlayClass).top(this.panel);return this;},attachMutationEvent:function(){this.observer=new MutationObserver(()=>{this._checkTogglers();});this.observer.observe(this.offcanvas[0],{childList:true,subtree:true,});},attachTouchEvents:function(){var msPointerSupported=window.navigator.msPointerEnabled,touch={start:msPointerSupported?'MSPointerDown':'touchstart',move:msPointerSupported?'MSPointerMove':'touchmove',end:msPointerSupported?'MSPointerUp':'touchend'};this._scrollBound=decouple(window,'scroll',this.bound('_bodyScroll'));this.bodyEl.on(touch.move,this.bound('_bodyMove'));this.panel.on(touch.start,this.bound('_touchStart'));this.panel.on('touchcancel',this.bound('_touchCancel'));this.panel.on(touch.end,this.bound('_touchEnd'));this.panel.on(touch.move,this.bound('_touchMove'));},detach:function(){this.attached=false;if(this.options.touch&&hasTouchEvents){this.detachTouchEvents();}forEach(['toggle','open','close'],bind(function(mode){this.bodyEl.undelegate('click','[data-offcanvas-'+mode+']',this.bound(mode));if(hasTouchEvents){this.bodyEl.undelegate('touchend','[data-offcanvas-'+mode+']',this.bound(mode));}},this));this.detachMutationEvent();this.overlay.remove();return this;},detachMutationEvent:function(){this.observer.disconnect();},detachTouchEvents:function(){var msPointerSupported=window.navigator.msPointerEnabled,touch={start:msPointerSupported?'MSPointerDown':'touchstart',move:msPointerSupported?'MSPointerMove':'touchmove',end:msPointerSupported?'MSPointerUp':'touchend'};window.removeEventListener('scroll',this._scrollBound);this.bodyEl.off(touch.move,this.bound('_bodyMove'));this.panel.off(touch.start,this.bound('_touchStart'));this.panel.off('touchcancel',this.bound('_touchCancel'));this.panel.off(touch.end,this.bound('_touchEnd'));this.panel.off(touch.move,this.bound('_touchMove'));},open:function(event){if(event&&event.type.match(/^touch/i)){event.preventDefault();}else{this.dragging=false;}if(this.opened){return this;}this.htmlEl.addClass(this.options.openClass);this.htmlEl.addClass(this.options.openingClass);this.overlay[0].style.opacity=1;if(this.options.css3){this.panel[0].style[this.getOffcanvasPosition()]='inherit';}this._setTransition();this._translateXTo((this.bodyEl.hasClass('g-offcanvas-right')?-1:1)*this.options.padding);this.opened=true;setTimeout(bind(function(){var panel=this.panel[0];this.htmlEl.removeClass(this.options.openingClass);this.offcanvas.attribute('aria-expanded',true);$('[data-offcanvas-toggle]').attribute('aria-expanded',true);panel.style.transition=panel.style[prefix.css+'transition']='';},this),this.options.duration);return this;},close:function(event,element){if(event&&event.type.match(/^touch/i)){event.preventDefault();}else{this.dragging=false;}element=element||window;if(!this.opened&&!this.opening){return this;}if(this.panel!==element&&this.dragging){return false;}this.htmlEl.addClass(this.options.closingClass);this.overlay[0].style.opacity=0;this._setTransition();this._translateXTo(0);this.opened=false;this.offcanvas.attribute('aria-expanded',false);$('[data-offcanvas-toggle]').attribute('aria-expanded',false);setTimeout(bind(function(){var panel=this.panel[0];this.htmlEl.removeClass(this.options.openClass);this.htmlEl.removeClass(this.options.closingClass);panel.style.transition=panel.style[prefix.css+'transition']='';panel.style.transform=panel.style[prefix.css+'transform']='';panel.style[this.getOffcanvasPosition()]='';},this),this.options.duration);return this;},toggle:function(event,element){if(event&&event.type.match(/^touch/i)){event.preventDefault();}else{this.dragging=false;}return this[this.opened?'close':'open'](event,element);},getOffcanvasPosition:function(){return this.bodyEl.hasClass('g-offcanvas-right')?'right':'left';},_setTransition:function(){var panel=this.panel[0];if(this.options.css3){panel.style[prefix.css+'transition']=panel.style.transition=prefix.css+'transform '+this.options.duration+'ms '+this.options.effect;}else{panel.style[prefix.css+'transition']=panel.style.transition='left '+this.options.duration+'ms '+this.options.effect+', right '+this.options.duration+'ms '+this.options.effect;}},_translateXTo:function(x){var panel=this.panel[0],placement=this.getOffcanvasPosition();this.offset.x.current=x;if(this.options.css3){panel.style[prefix.css+'transform']=panel.style.transform='translate3d('+x+'px, 0, 0)';}else{panel.style[placement]=Math.abs(x)+'px';}},_bodyScroll:function(){if(!this.moved){clearTimeout(scrollTimeout);isScrolling=true;scrollTimeout=setTimeout(function(){isScrolling=false;},250);}},_bodyMove:function(){if(this.moved){event.preventDefault();}this.dragging=true;return false;},_touchStart:function(event){if(!event.touches){return;}this.moved=false;this.opening=false;this.dragging=false;this.offset.x.start=event.touches[0].pageX;this.offset.y.start=event.touches[0].pageY;this.preventOpen=(!this.opened&&this.offcanvas[0].clientWidth!==0);},_touchCancel:function(){this.moved=false;this.opening=false;},_touchMove:function(event){if(isScrolling||this.preventOpen||!event.touches){return;}if(this.options.css3){this.panel[0].style[this.getOffcanvasPosition()]='inherit';}var placement=this.getOffcanvasPosition(),diffX=clamp(event.touches[0].clientX-this.offset.x.start,-this.options.padding,this.options.padding),translateX=this.offset.x.current=diffX,diffY=Math.abs(event.touches[0].pageY-this.offset.y.start),offset=placement=='right'?-1:1,overlayOpacity;if(Math.abs(translateX)>this.options.padding){return;}if(diffY>5&&!this.moved){return;}if(Math.abs(diffX)>0){this.opening=true;if(placement=='left'&&(this.opened&&diffX>0||!this.opened&&diffX<0)){return;}if(placement=='right'&&(this.opened&&diffX<0||!this.opened&&diffX>0)){return;}if(!this.moved&&!this.htmlEl.hasClass(this.options.openClass)){this.htmlEl.addClass(this.options.openClass);}if((placement=='left'&&diffX<=0)||(placement=='right'&&diffX>=0)){translateX=diffX+(offset*this.options.padding);this.opening=false;}overlayOpacity=mapNumber(Math.abs(translateX),0,this.options.padding,0,1);this.overlay[0].style.opacity=overlayOpacity;if(this.options.css3){this.panel[0].style[prefix.css+'transform']=this.panel[0].style.transform='translate3d('+translateX+'px, 0, 0)';}else{this.panel[0].style[placement]=Math.abs(translateX)+'px';}this.moved=true;}},_touchEnd:function(event){if(this.moved){var tolerance=Math.abs(this.offset.x.current)>this.tolerance,placement=this.bodyEl.hasClass('g-offcanvas-right')?true:false,direction=!placement?(this.offset.x.current<0):(this.offset.x.current>0);this.opening=tolerance?!direction:direction;this.opened=!this.opening;this[this.opening?'open':'close'](event,this.panel);}this.moved=false;return true;},_checkTogglers:function(mutator){var togglers=$('[data-offcanvas-toggle], [data-offcanvas-open], [data-offcanvas-close]'),mobileContainer=$('#g-mobilemenu-container'),blocks,mCtext;if(!togglers||(mutator&&((mutator.target||mutator.srcElement)!==mobileContainer[0]))){return;}if(this.opened){this.close();}timeout(function(){blocks=this.offcanvas.search('.g-block');mCtext=mobileContainer?mobileContainer.text().length:0;var shouldCollapse=(blocks&&blocks.length===1)&&mobileContainer&&(!trim(this.offcanvas.text()).length&&!blocks.find('.g-menu-item'));togglers[shouldCollapse?'addClass':'removeClass']('g-offcanvas-hide');if(mobileContainer){mobileContainer.parent('.g-block')[!mCtext?'addClass':'removeClass']('hidden');}if(!shouldCollapse&&!this.attached){this.attach();}else if(shouldCollapse&&this.attached){this.detach();this.attachMutationEvent();}},0,this);}});module.exports=Offcanvas;},{"../utils/decouple":5,"domready":7,"elements":12,"elements/zen":36,"mout/array/forEach":37,"mout/function/bind":40,"mout/function/timeout":44,"mout/math/clamp":49,"mout/math/map":51,"mout/string/trim":60,"prime":85,"prime-util/prime/bound":81,"prime-util/prime/options":82}],4:[function(require,module,exports){"use strict";var ready=require('domready'),$=require('../utils/dollar-extras');var timeOut,scrollToTop=function(){if(document.body.scrollTop!=0||document.documentElement.scrollTop!=0){window.scrollBy(0,-50);timeOut=setTimeout(scrollToTop,10);}else{clearTimeout(timeOut);}};ready(function(){var totop=$('#g-totop');if(!totop){return;}totop.on('click',function(e){e.preventDefault();scrollToTop();});});module.exports={};},{"../utils/dollar-extras":6,"domready":7}],5:[function(require,module,exports){'use strict';var rAF=(function(){return window.requestAnimationFrame||window.webkitRequestAnimationFrame||function(callback){window.setTimeout(callback,1000/60);};}());var decouple=function(element,event,callback){var evt,tracking=false;element=element[0]||element;var capture=function(e){evt=e;track();};var track=function(){if(!tracking){rAF(update);tracking=true;}};var update=function(){callback.call(element,evt);tracking=false;};try{element.addEventListener(event,capture,false);}catch(e){}return capture;};module.exports=decouple;},{}],6:[function(require,module,exports){"use strict";var $=require('elements'),map=require('mout/array/map'),slick=require('slick');var walk=function(combinator,method){return function(expression){var parts=slick.parse(expression||"*");expression=map(parts,function(part){return combinator+" "+part;}).join(', ');return this[method](expression);};};$.implement({sibling:walk('++','find'),siblings:walk('~~','search')});module.exports=$;},{"elements":12,"mout/array/map":38,"slick":97}],7:[function(require,module,exports){!function(name,definition){if(typeof module!='undefined')module.exports=definition()
else if(typeof define=='function'&&typeof define.amd=='object')define(definition)
else this[name]=definition()}('domready',function(){var fns=[],listener,doc=document,hack=doc.documentElement.doScroll,domContentLoaded='DOMContentLoaded',loaded=(hack?/^loaded|^c/:/^loaded|^i|^c/).test(doc.readyState)
if(!loaded)doc.addEventListener(domContentLoaded,listener=function(){doc.removeEventListener(domContentLoaded,listener)
loaded=1
while(listener=fns.shift())listener()})
return function(fn){loaded?setTimeout(fn,0):fns.push(fn)}});},{}],8:[function(require,module,exports){"use strict"
var $=require("./base")
var trim=require("mout/string/trim"),forEach=require("mout/array/forEach"),filter=require("mout/array/filter"),indexOf=require("mout/array/indexOf")
$.implement({setAttribute:function(name,value){return this.forEach(function(node){node.setAttribute(name,value)})},getAttribute:function(name){var attr=this[0].getAttributeNode(name)
return(attr&&attr.specified)?attr.value:null},hasAttribute:function(name){var node=this[0]
if(node.hasAttribute)return node.hasAttribute(name)
var attr=node.getAttributeNode(name)
return!!(attr&&attr.specified)},removeAttribute:function(name){return this.forEach(function(node){var attr=node.getAttributeNode(name)
if(attr)node.removeAttributeNode(attr)})}})
var accessors={}
forEach(["type","value","name","href","title","id"],function(name){accessors[name]=function(value){return(value!==undefined)?this.forEach(function(node){node[name]=value}):this[0][name]}})
forEach(["checked","disabled","selected"],function(name){accessors[name]=function(value){return(value!==undefined)?this.forEach(function(node){node[name]=!!value}):!!this[0][name]}})
var classes=function(className){var classNames=trim(className).replace(/\s+/g," ").split(" "),uniques={}
return filter(classNames,function(className){if(className!==""&&!uniques[className])return uniques[className]=className}).sort()}
accessors.className=function(className){return(className!==undefined)?this.forEach(function(node){node.className=classes(className).join(" ")}):classes(this[0].className).join(" ")}
$.implement({attribute:function(name,value){var accessor=accessors[name]
if(accessor)return accessor.call(this,value)
if(value!=null)return this.setAttribute(name,value)
if(value===null)return this.removeAttribute(name)
if(value===undefined)return this.getAttribute(name)}})
$.implement(accessors)
$.implement({check:function(){return this.checked(true)},uncheck:function(){return this.checked(false)},disable:function(){return this.disabled(true)},enable:function(){return this.disabled(false)},select:function(){return this.selected(true)},deselect:function(){return this.selected(false)}})
$.implement({classNames:function(){return classes(this[0].className)},hasClass:function(className){return indexOf(this.classNames(),className)>-1},addClass:function(className){return this.forEach(function(node){var nodeClassName=node.className
var classNames=classes(nodeClassName+" "+className).join(" ")
if(nodeClassName!==classNames)node.className=classNames})},removeClass:function(className){return this.forEach(function(node){var classNames=classes(node.className)
forEach(classes(className),function(className){var index=indexOf(classNames,className)
if(index>-1)classNames.splice(index,1)})
node.className=classNames.join(" ")})},toggleClass:function(className,force){var add=force!==undefined?force:!this.hasClass(className)
if(add)this.addClass(className)
else
this.removeClass(className)
return!!add}})
$.prototype.toString=function(){var tag=this.tag(),id=this.id(),classes=this.classNames()
var str=tag
if(id)str+='#'+id
if(classes.length)str+='.'+classes.join(".")
return str}
var textProperty=(document.createElement('div').textContent==null)?'innerText':'textContent'
$.implement({tag:function(){return this[0].tagName.toLowerCase()},html:function(html){return(html!==undefined)?this.forEach(function(node){node.innerHTML=html}):this[0].innerHTML},text:function(text){return(text!==undefined)?this.forEach(function(node){node[textProperty]=text}):this[0][textProperty]},data:function(key,value){switch(value){case undefined:return this.getAttribute("data-"+key)
case null:return this.removeAttribute("data-"+key)
default:return this.setAttribute("data-"+key,value)}}})
module.exports=$},{"./base":9,"mout/array/filter":15,"mout/array/forEach":16,"mout/array/indexOf":17,"mout/string/trim":34}],9:[function(require,module,exports){"use strict"
var prime=require("prime")
var forEach=require("mout/array/forEach"),map=require("mout/array/map"),filter=require("mout/array/filter"),every=require("mout/array/every"),some=require("mout/array/some")
var index=0,__dc=document.__counter,counter=document.__counter=(__dc?parseInt(__dc,36)+1:0).toString(36),key="uid:"+counter
var uniqueID=function(n){if(n===window)return"window"
if(n===document)return"document"
if(n===document.documentElement)return"html"
return n[key]||(n[key]=(index++).toString(36))}
var instances={}
var $=prime({constructor:function $(n,context){if(n==null)return(this&&this.constructor===$)?new Elements:null
var self,uid
if(n.constructor!==Elements){self=new Elements
if(typeof n==="string"){if(!self.search)return null
self[self.length++]=context||document
return self.search(n)}if(n.nodeType||n===window){self[self.length++]=n}else if(n.length){var uniques={}
for(var i=0,l=n.length;i<l;i++){var nodes=$(n[i],context)
if(nodes&&nodes.length)for(var j=0,k=nodes.length;j<k;j++){var node=nodes[j]
uid=uniqueID(node)
if(!uniques[uid]){self[self.length++]=node
uniques[uid]=true}}}}}else{self=n}if(!self.length)return null
if(self.length===1){uid=uniqueID(self[0])
return instances[uid]||(instances[uid]=self)}return self}})
var Elements=prime({inherits:$,constructor:function Elements(){this.length=0},unlink:function(){return this.map(function(node){delete instances[uniqueID(node)]
return node})},forEach:function(method,context){forEach(this,method,context)
return this},map:function(method,context){return map(this,method,context)},filter:function(method,context){return filter(this,method,context)},every:function(method,context){return every(this,method,context)},some:function(method,context){return some(this,method,context)}})
module.exports=$},{"mout/array/every":14,"mout/array/filter":15,"mout/array/forEach":16,"mout/array/map":18,"mout/array/some":19,"prime":85}],10:[function(require,module,exports){"use strict"
var Map=require("prime/map")
var $=require("./events")
require('./traversal')
$.implement({delegate:function(event,selector,handle,useCapture){return this.forEach(function(node){var self=$(node)
var delegation=self._delegation||(self._delegation={}),events=delegation[event]||(delegation[event]={}),map=(events[selector]||(events[selector]=new Map))
if(map.get(handle))return
var action=function(e){var target=$(e.target||e.srcElement),match=target.matches(selector)?target:target.parent(selector)
var res
if(match)res=handle.call(self,e,match)
return res}
map.set(handle,action)
self.on(event,action,useCapture)})},undelegate:function(event,selector,handle,useCapture){return this.forEach(function(node){var self=$(node),delegation,events,map
if(!(delegation=self._delegation)||!(events=delegation[event])||!(map=events[selector]))return;var action=map.get(handle)
if(action){self.off(event,action,useCapture)
map.remove(action)
if(!map.count())delete events[selector]
var e1=true,e2=true,x
for(x in events){e1=false
break}if(e1)delete delegation[event]
for(x in delegation){e2=false
break}if(e2)delete self._delegation}})}})
module.exports=$},{"./events":11,"./traversal":35,"prime/map":86}],11:[function(require,module,exports){"use strict"
var Emitter=require("prime/emitter")
var $=require("./base")
var html=document.documentElement
var addEventListener=html.addEventListener?function(node,event,handle,useCapture){node.addEventListener(event,handle,useCapture||false)
return handle}:function(node,event,handle){node.attachEvent('on'+event,handle)
return handle}
var removeEventListener=html.removeEventListener?function(node,event,handle,useCapture){node.removeEventListener(event,handle,useCapture||false)}:function(node,event,handle){node.detachEvent("on"+event,handle)}
$.implement({on:function(event,handle,useCapture){return this.forEach(function(node){var self=$(node)
var internalEvent=event+(useCapture?":capture":"")
Emitter.prototype.on.call(self,internalEvent,handle)
var domListeners=self._domListeners||(self._domListeners={})
if(!domListeners[internalEvent])domListeners[internalEvent]=addEventListener(node,event,function(e){Emitter.prototype.emit.call(self,internalEvent,e||window.event,Emitter.EMIT_SYNC)},useCapture)})},off:function(event,handle,useCapture){return this.forEach(function(node){var self=$(node)
var internalEvent=event+(useCapture?":capture":"")
var domListeners=self._domListeners,domEvent,listeners=self._listeners,events
if(domListeners&&(domEvent=domListeners[internalEvent])&&listeners&&(events=listeners[internalEvent])){Emitter.prototype.off.call(self,internalEvent,handle)
if(!self._listeners||!self._listeners[event]){removeEventListener(node,event,domEvent)
delete domListeners[event]
for(var l in domListeners)return
delete self._domListeners}}})},emit:function(){var args=arguments
return this.forEach(function(node){Emitter.prototype.emit.apply($(node),args)})}})
module.exports=$},{"./base":9,"prime/emitter":84}],12:[function(require,module,exports){"use strict"
var $=require("./base")
require("./attributes")
require("./events")
require("./insertion")
require("./traversal")
require("./delegation")
module.exports=$},{"./attributes":8,"./base":9,"./delegation":10,"./events":11,"./insertion":13,"./traversal":35}],13:[function(require,module,exports){"use strict"
var $=require("./base")
$.implement({appendChild:function(child){this[0].appendChild($(child)[0])
return this},insertBefore:function(child,ref){this[0].insertBefore($(child)[0],$(ref)[0])
return this},removeChild:function(child){this[0].removeChild($(child)[0])
return this},replaceChild:function(child,ref){this[0].replaceChild($(child)[0],$(ref)[0])
return this}})
$.implement({before:function(element){element=$(element)[0]
var parent=element.parentNode
if(parent)this.forEach(function(node){parent.insertBefore(node,element)})
return this},after:function(element){element=$(element)[0]
var parent=element.parentNode
if(parent)this.forEach(function(node){parent.insertBefore(node,element.nextSibling)})
return this},bottom:function(element){element=$(element)[0]
return this.forEach(function(node){element.appendChild(node)})},top:function(element){element=$(element)[0]
return this.forEach(function(node){element.insertBefore(node,element.firstChild)})}})
$.implement({insert:$.prototype.bottom,remove:function(){return this.forEach(function(node){var parent=node.parentNode
if(parent)parent.removeChild(node)})},replace:function(element){element=$(element)[0]
element.parentNode.replaceChild(this[0],element)
return this}})
module.exports=$},{"./base":9}],14:[function(require,module,exports){var makeIterator=require('../function/makeIterator_');function every(arr,callback,thisObj){callback=makeIterator(callback,thisObj);var result=true;if(arr==null){return result;}var i=-1,len=arr.length;while(++i<len){if(!callback(arr[i],i,arr)){result=false;break;}}return result;}module.exports=every;},{"../function/makeIterator_":21}],15:[function(require,module,exports){var makeIterator=require('../function/makeIterator_');function filter(arr,callback,thisObj){callback=makeIterator(callback,thisObj);var results=[];if(arr==null){return results;}var i=-1,len=arr.length,value;while(++i<len){value=arr[i];if(callback(value,i,arr)){results.push(value);}}return results;}module.exports=filter;},{"../function/makeIterator_":21}],16:[function(require,module,exports){function forEach(arr,callback,thisObj){if(arr==null){return;}var i=-1,len=arr.length;while(++i<len){if(callback.call(thisObj,arr[i],i,arr)===false){break;}}}module.exports=forEach;},{}],17:[function(require,module,exports){function indexOf(arr,item,fromIndex){fromIndex=fromIndex||0;if(arr==null){return-1;}var len=arr.length,i=fromIndex<0?len+fromIndex:fromIndex;while(i<len){if(arr[i]===item){return i;}i++;}return-1;}module.exports=indexOf;},{}],18:[function(require,module,exports){var makeIterator=require('../function/makeIterator_');function map(arr,callback,thisObj){callback=makeIterator(callback,thisObj);var results=[];if(arr==null){return results;}var i=-1,len=arr.length;while(++i<len){results[i]=callback(arr[i],i,arr);}return results;}module.exports=map;},{"../function/makeIterator_":21}],19:[function(require,module,exports){var makeIterator=require('../function/makeIterator_');function some(arr,callback,thisObj){callback=makeIterator(callback,thisObj);var result=false;if(arr==null){return result;}var i=-1,len=arr.length;while(++i<len){if(callback(arr[i],i,arr)){result=true;break;}}return result;}module.exports=some;},{"../function/makeIterator_":21}],20:[function(require,module,exports){function identity(val){return val;}module.exports=identity;},{}],21:[function(require,module,exports){var identity=require('./identity');var prop=require('./prop');var deepMatches=require('../object/deepMatches');function makeIterator(src,thisObj){if(src==null){return identity;}switch(typeof src){case'function':return(typeof thisObj!=='undefined')?function(val,i,arr){return src.call(thisObj,val,i,arr);}:src;case'object':return function(val){return deepMatches(val,src);};case'string':case'number':return prop(src);}}module.exports=makeIterator;},{"../object/deepMatches":27,"./identity":20,"./prop":22}],22:[function(require,module,exports){function prop(name){return function(obj){return obj[name];};}module.exports=prop;},{}],23:[function(require,module,exports){var isKind=require('./isKind');var isArray=Array.isArray||function(val){return isKind(val,'Array');};module.exports=isArray;},{"./isKind":24}],24:[function(require,module,exports){var kindOf=require('./kindOf');function isKind(val,kind){return kindOf(val)===kind;}module.exports=isKind;},{"./kindOf":25}],25:[function(require,module,exports){var _rKind=/^\[object (.*)\]$/,_toString=Object.prototype.toString,UNDEF;function kindOf(val){if(val===null){return'Null';}else if(val===UNDEF){return'Undefined';}else{return _rKind.exec(_toString.call(val))[1];}}module.exports=kindOf;},{}],26:[function(require,module,exports){function toString(val){return val==null?'':val.toString();}module.exports=toString;},{}],27:[function(require,module,exports){var forOwn=require('./forOwn');var isArray=require('../lang/isArray');function containsMatch(array,pattern){var i=-1,length=array.length;while(++i<length){if(deepMatches(array[i],pattern)){return true;}}return false;}function matchArray(target,pattern){var i=-1,patternLength=pattern.length;while(++i<patternLength){if(!containsMatch(target,pattern[i])){return false;}}return true;}function matchObject(target,pattern){var result=true;forOwn(pattern,function(val,key){if(!deepMatches(target[key],val)){return(result=false);}});return result;}function deepMatches(target,pattern){if(target&&typeof target==='object'){if(isArray(target)&&isArray(pattern)){return matchArray(target,pattern);}else{return matchObject(target,pattern);}}else{return target===pattern;}}module.exports=deepMatches;},{"../lang/isArray":23,"./forOwn":29}],28:[function(require,module,exports){var hasOwn=require('./hasOwn');var _hasDontEnumBug,_dontEnums;function checkDontEnum(){_dontEnums=['toString','toLocaleString','valueOf','hasOwnProperty','isPrototypeOf','propertyIsEnumerable','constructor'];_hasDontEnumBug=true;for(var key in{'toString':null}){_hasDontEnumBug=false;}}function forIn(obj,fn,thisObj){var key,i=0;if(_hasDontEnumBug==null)checkDontEnum();for(key in obj){if(exec(fn,obj,key,thisObj)===false){break;}}if(_hasDontEnumBug){var ctor=obj.constructor,isProto=!!ctor&&obj===ctor.prototype;while(key=_dontEnums[i++]){if((key!=='constructor'||(!isProto&&hasOwn(obj,key)))&&obj[key]!==Object.prototype[key]){if(exec(fn,obj,key,thisObj)===false){break;}}}}}function exec(fn,obj,key,thisObj){return fn.call(thisObj,obj[key],key,obj);}module.exports=forIn;},{"./hasOwn":30}],29:[function(require,module,exports){var hasOwn=require('./hasOwn');var forIn=require('./forIn');function forOwn(obj,fn,thisObj){forIn(obj,function(val,key){if(hasOwn(obj,key)){return fn.call(thisObj,obj[key],key,obj);}});}module.exports=forOwn;},{"./forIn":28,"./hasOwn":30}],30:[function(require,module,exports){function hasOwn(obj,prop){return Object.prototype.hasOwnProperty.call(obj,prop);}module.exports=hasOwn;},{}],31:[function(require,module,exports){module.exports=[' ','\n','\r','\t','\f','\v','\u00A0','\u1680','\u180E','\u2000','\u2001','\u2002','\u2003','\u2004','\u2005','\u2006','\u2007','\u2008','\u2009','\u200A','\u2028','\u2029','\u202F','\u205F','\u3000'];},{}],32:[function(require,module,exports){var toString=require('../lang/toString');var WHITE_SPACES=require('./WHITE_SPACES');function ltrim(str,chars){str=toString(str);chars=chars||WHITE_SPACES;var start=0,len=str.length,charLen=chars.length,found=true,i,c;while(found&&start<len){found=false;i=-1;c=str.charAt(start);while(++i<charLen){if(c===chars[i]){found=true;start++;break;}}}return(start>=len)?'':str.substr(start,len);}module.exports=ltrim;},{"../lang/toString":26,"./WHITE_SPACES":31}],33:[function(require,module,exports){var toString=require('../lang/toString');var WHITE_SPACES=require('./WHITE_SPACES');function rtrim(str,chars){str=toString(str);chars=chars||WHITE_SPACES;var end=str.length-1,charLen=chars.length,found=true,i,c;while(found&&end>=0){found=false;i=-1;c=str.charAt(end);while(++i<charLen){if(c===chars[i]){found=true;end--;break;}}}return(end>=0)?str.substring(0,end+1):'';}module.exports=rtrim;},{"../lang/toString":26,"./WHITE_SPACES":31}],34:[function(require,module,exports){var toString=require('../lang/toString');var WHITE_SPACES=require('./WHITE_SPACES');var ltrim=require('./ltrim');var rtrim=require('./rtrim');function trim(str,chars){str=toString(str);chars=chars||WHITE_SPACES;return ltrim(rtrim(str,chars),chars);}module.exports=trim;},{"../lang/toString":26,"./WHITE_SPACES":31,"./ltrim":32,"./rtrim":33}],35:[function(require,module,exports){"use strict"
var map=require("mout/array/map")
var slick=require("slick")
var $=require("./base")
var gen=function(combinator,expression){return map(slick.parse(expression||"*"),function(part){return combinator+" "+part}).join(", ")}
var push_=Array.prototype.push
$.implement({search:function(expression){if(this.length===1)return $(slick.search(expression,this[0],new $))
var buffer=[]
for(var i=0,node;node=this[i];i++)push_.apply(buffer,slick.search(expression,node))
buffer=$(buffer)
return buffer&&buffer.sort()},find:function(expression){if(this.length===1)return $(slick.find(expression,this[0]))
for(var i=0,node;node=this[i];i++){var found=slick.find(expression,node)
if(found)return $(found)}return null},sort:function(){return slick.sort(this)},matches:function(expression){return slick.matches(this[0],expression)},contains:function(node){return slick.contains(this[0],node)},nextSiblings:function(expression){return this.search(gen('~',expression))},nextSibling:function(expression){return this.find(gen('+',expression))},previousSiblings:function(expression){return this.search(gen('!~',expression))},previousSibling:function(expression){return this.find(gen('!+',expression))},children:function(expression){return this.search(gen('>',expression))},firstChild:function(expression){return this.find(gen('^',expression))},lastChild:function(expression){return this.find(gen('!^',expression))},parent:function(expression){var buffer=[]
loop:for(var i=0,node;node=this[i];i++)while((node=node.parentNode)&&(node!==document)){if(!expression||slick.matches(node,expression)){buffer.push(node)
break loop
break}}return $(buffer)},parents:function(expression){var buffer=[]
for(var i=0,node;node=this[i];i++)while((node=node.parentNode)&&(node!==document)){if(!expression||slick.matches(node,expression))buffer.push(node)}return $(buffer)}})
module.exports=$},{"./base":9,"mout/array/map":18,"slick":97}],36:[function(require,module,exports){"use strict"
var forEach=require("mout/array/forEach"),map=require("mout/array/map")
var parse=require("slick/parser")
var $=require("./base")
module.exports=function(expression,doc){return $(map(parse(expression),function(expression){var previous,result
forEach(expression,function(part,i){var node=(doc||document).createElement(part.tag)
if(part.id)node.id=part.id
if(part.classList)node.className=part.classList.join(" ")
if(part.attributes)forEach(part.attributes,function(attribute){node.setAttribute(attribute.name,attribute.value||"")})
if(part.pseudos)forEach(part.pseudos,function(pseudo){var n=$(node),method=n[pseudo.name]
if(method)method.call(n,pseudo.value)})
if(i===0){result=node}else if(part.combinator===" "){previous.appendChild(node)}else if(part.combinator==="+"){var parentNode=previous.parentNode
if(parentNode)parentNode.appendChild(node)}previous=node})
return result}))}},{"./base":9,"mout/array/forEach":16,"mout/array/map":18,"slick/parser":98}],37:[function(require,module,exports){function forEach(arr,callback,thisObj){if(arr==null){return;}var i=-1,len=arr.length;while(++i<len){if(callback.call(thisObj,arr[i],i,arr)===false){break;}}}module.exports=forEach;},{}],38:[function(require,module,exports){var makeIterator=require('../function/makeIterator_');function map(arr,callback,thisObj){callback=makeIterator(callback,thisObj);var results=[];if(arr==null){return results;}var i=-1,len=arr.length;while(++i<len){results[i]=callback(arr[i],i,arr);}return results;}module.exports=map;},{"../function/makeIterator_":42}],39:[function(require,module,exports){function slice(arr,start,end){var len=arr.length;if(start==null){start=0;}else if(start<0){start=Math.max(len+start,0);}else{start=Math.min(start,len);}if(end==null){end=len;}else if(end<0){end=Math.max(len+end,0);}else{end=Math.min(end,len);}var result=[];while(start<end){result.push(arr[start++]);}return result;}module.exports=slice;},{}],40:[function(require,module,exports){var slice=require('../array/slice');function bind(fn,context,args){var argsArr=slice(arguments,2);return function(){return fn.apply(context,argsArr.concat(slice(arguments)));};}module.exports=bind;},{"../array/slice":39}],41:[function(require,module,exports){function identity(val){return val;}module.exports=identity;},{}],42:[function(require,module,exports){var identity=require('./identity');var prop=require('./prop');var deepMatches=require('../object/deepMatches');function makeIterator(src,thisObj){if(src==null){return identity;}switch(typeof src){case'function':return(typeof thisObj!=='undefined')?function(val,i,arr){return src.call(thisObj,val,i,arr);}:src;case'object':return function(val){return deepMatches(val,src);};case'string':case'number':return prop(src);}}module.exports=makeIterator;},{"../object/deepMatches":53,"./identity":41,"./prop":43}],43:[function(require,module,exports){function prop(name){return function(obj){return obj[name];};}module.exports=prop;},{}],44:[function(require,module,exports){var slice=require('../array/slice');function timeout(fn,millis,context){var args=slice(arguments,3);return setTimeout(function(){fn.apply(context,args);},millis);}module.exports=timeout;},{"../array/slice":39}],45:[function(require,module,exports){var isKind=require('./isKind');var isArray=Array.isArray||function(val){return isKind(val,'Array');};module.exports=isArray;},{"./isKind":46}],46:[function(require,module,exports){var kindOf=require('./kindOf');function isKind(val,kind){return kindOf(val)===kind;}module.exports=isKind;},{"./kindOf":47}],47:[function(require,module,exports){function kindOf(val){return Object.prototype.toString.call(val).slice(8,-1);}module.exports=kindOf;},{}],48:[function(require,module,exports){function toString(val){return val==null?'':val.toString();}module.exports=toString;},{}],49:[function(require,module,exports){function clamp(val,min,max){return val<min?min:(val>max?max:val);}module.exports=clamp;},{}],50:[function(require,module,exports){function lerp(ratio,start,end){return start+(end-start)*ratio;}module.exports=lerp;},{}],51:[function(require,module,exports){var lerp=require('./lerp');var norm=require('./norm');function map(val,min1,max1,min2,max2){return lerp(norm(val,min1,max1),min2,max2);}module.exports=map;},{"./lerp":50,"./norm":52}],52:[function(require,module,exports){function norm(val,min,max){if(val<min||val>max){throw new RangeError('value ('+val+') must be between '+min+' and '+max);}return val===max?1:(val-min)/(max-min);}module.exports=norm;},{}],53:[function(require,module,exports){var forOwn=require('./forOwn');var isArray=require('../lang/isArray');function containsMatch(array,pattern){var i=-1,length=array.length;while(++i<length){if(deepMatches(array[i],pattern)){return true;}}return false;}function matchArray(target,pattern){var i=-1,patternLength=pattern.length;while(++i<patternLength){if(!containsMatch(target,pattern[i])){return false;}}return true;}function matchObject(target,pattern){var result=true;forOwn(pattern,function(val,key){if(!deepMatches(target[key],val)){return(result=false);}});return result;}function deepMatches(target,pattern){if(target&&typeof target==='object'&&pattern&&typeof pattern==='object'){if(isArray(target)&&isArray(pattern)){return matchArray(target,pattern);}else{return matchObject(target,pattern);}}else{return target===pattern;}}module.exports=deepMatches;},{"../lang/isArray":45,"./forOwn":55}],54:[function(require,module,exports){var hasOwn=require('./hasOwn');var _hasDontEnumBug,_dontEnums;function checkDontEnum(){_dontEnums=['toString','toLocaleString','valueOf','hasOwnProperty','isPrototypeOf','propertyIsEnumerable','constructor'];_hasDontEnumBug=true;for(var key in{'toString':null}){_hasDontEnumBug=false;}}function forIn(obj,fn,thisObj){var key,i=0;if(_hasDontEnumBug==null)checkDontEnum();for(key in obj){if(exec(fn,obj,key,thisObj)===false){break;}}if(_hasDontEnumBug){var ctor=obj.constructor,isProto=!!ctor&&obj===ctor.prototype;while(key=_dontEnums[i++]){if((key!=='constructor'||(!isProto&&hasOwn(obj,key)))&&obj[key]!==Object.prototype[key]){if(exec(fn,obj,key,thisObj)===false){break;}}}}}function exec(fn,obj,key,thisObj){return fn.call(thisObj,obj[key],key,obj);}module.exports=forIn;},{"./hasOwn":56}],55:[function(require,module,exports){var hasOwn=require('./hasOwn');var forIn=require('./forIn');function forOwn(obj,fn,thisObj){forIn(obj,function(val,key){if(hasOwn(obj,key)){return fn.call(thisObj,obj[key],key,obj);}});}module.exports=forOwn;},{"./forIn":54,"./hasOwn":56}],56:[function(require,module,exports){function hasOwn(obj,prop){return Object.prototype.hasOwnProperty.call(obj,prop);}module.exports=hasOwn;},{}],57:[function(require,module,exports){module.exports=[' ','\n','\r','\t','\f','\v','\u00A0','\u1680','\u180E','\u2000','\u2001','\u2002','\u2003','\u2004','\u2005','\u2006','\u2007','\u2008','\u2009','\u200A','\u2028','\u2029','\u202F','\u205F','\u3000'];},{}],58:[function(require,module,exports){var toString=require('../lang/toString');var WHITE_SPACES=require('./WHITE_SPACES');function ltrim(str,chars){str=toString(str);chars=chars||WHITE_SPACES;var start=0,len=str.length,charLen=chars.length,found=true,i,c;while(found&&start<len){found=false;i=-1;c=str.charAt(start);while(++i<charLen){if(c===chars[i]){found=true;start++;break;}}}return(start>=len)?'':str.substr(start,len);}module.exports=ltrim;},{"../lang/toString":48,"./WHITE_SPACES":57}],59:[function(require,module,exports){var toString=require('../lang/toString');var WHITE_SPACES=require('./WHITE_SPACES');function rtrim(str,chars){str=toString(str);chars=chars||WHITE_SPACES;var end=str.length-1,charLen=chars.length,found=true,i,c;while(found&&end>=0){found=false;i=-1;c=str.charAt(end);while(++i<charLen){if(c===chars[i]){found=true;end--;break;}}}return(end>=0)?str.substring(0,end+1):'';}module.exports=rtrim;},{"../lang/toString":48,"./WHITE_SPACES":57}],60:[function(require,module,exports){var toString=require('../lang/toString');var WHITE_SPACES=require('./WHITE_SPACES');var ltrim=require('./ltrim');var rtrim=require('./rtrim');function trim(str,chars){str=toString(str);chars=chars||WHITE_SPACES;return ltrim(rtrim(str,chars),chars);}module.exports=trim;},{"../lang/toString":48,"./WHITE_SPACES":57,"./ltrim":58,"./rtrim":59}],61:[function(require,module,exports){function slice(arr,start,end){var len=arr.length;if(start==null){start=0;}else if(start<0){start=Math.max(len+start,0);}else{start=Math.min(start,len);}if(end==null){end=len;}else if(end<0){end=Math.max(len+end,0);}else{end=Math.min(end,len);}var result=[];while(start<end){result.push(arr[start++]);}return result;}module.exports=slice;},{}],62:[function(require,module,exports){var slice=require('../array/slice');function bind(fn,context,args){var argsArr=slice(arguments,2);return function(){return fn.apply(context,argsArr.concat(slice(arguments)));};}module.exports=bind;},{"../array/slice":61}],63:[function(require,module,exports){var kindOf=require('./kindOf');var isPlainObject=require('./isPlainObject');var mixIn=require('../object/mixIn');function clone(val){switch(kindOf(val)){case'Object':return cloneObject(val);case'Array':return cloneArray(val);case'RegExp':return cloneRegExp(val);case'Date':return cloneDate(val);default:return val;}}function cloneObject(source){if(isPlainObject(source)){return mixIn({},source);}else{return source;}}function cloneRegExp(r){var flags='';flags+=r.multiline?'m':'';flags+=r.global?'g':'';flags+=r.ignorecase?'i':'';return new RegExp(r.source,flags);}function cloneDate(date){return new Date(+date);}function cloneArray(arr){return arr.slice();}module.exports=clone;},{"../object/mixIn":73,"./isPlainObject":67,"./kindOf":68}],64:[function(require,module,exports){var clone=require('./clone');var forOwn=require('../object/forOwn');var kindOf=require('./kindOf');var isPlainObject=require('./isPlainObject');function deepClone(val,instanceClone){switch(kindOf(val)){case'Object':return cloneObject(val,instanceClone);case'Array':return cloneArray(val,instanceClone);default:return clone(val);}}function cloneObject(source,instanceClone){if(isPlainObject(source)){var out={};forOwn(source,function(val,key){this[key]=deepClone(val,instanceClone);},out);return out;}else if(instanceClone){return instanceClone(source);}else{return source;}}function cloneArray(arr,instanceClone){var out=[],i=-1,n=arr.length,val;while(++i<n){out[i]=deepClone(arr[i],instanceClone);}return out;}module.exports=deepClone;},{"../object/forOwn":70,"./clone":63,"./isPlainObject":67,"./kindOf":68}],65:[function(require,module,exports){arguments[4][24][0].apply(exports,arguments)},{"./kindOf":68,"dup":24}],66:[function(require,module,exports){var isKind=require('./isKind');function isObject(val){return isKind(val,'Object');}module.exports=isObject;},{"./isKind":65}],67:[function(require,module,exports){function isPlainObject(value){return(!!value&&typeof value==='object'&&value.constructor===Object);}module.exports=isPlainObject;},{}],68:[function(require,module,exports){arguments[4][25][0].apply(exports,arguments)},{"dup":25}],69:[function(require,module,exports){arguments[4][28][0].apply(exports,arguments)},{"./hasOwn":71,"dup":28}],70:[function(require,module,exports){arguments[4][29][0].apply(exports,arguments)},{"./forIn":69,"./hasOwn":71,"dup":29}],71:[function(require,module,exports){arguments[4][30][0].apply(exports,arguments)},{"dup":30}],72:[function(require,module,exports){var hasOwn=require('./hasOwn');var deepClone=require('../lang/deepClone');var isObject=require('../lang/isObject');function merge(){var i=1,key,val,obj,target;target=deepClone(arguments[0]);while(obj=arguments[i++]){for(key in obj){if(!hasOwn(obj,key)){continue;}val=obj[key];if(isObject(val)&&isObject(target[key])){target[key]=merge(target[key],val);}else{target[key]=deepClone(val);}}}return target;}module.exports=merge;},{"../lang/deepClone":64,"../lang/isObject":66,"./hasOwn":71}],73:[function(require,module,exports){var forOwn=require('./forOwn');function mixIn(target,objects){var i=0,n=arguments.length,obj;while(++i<n){obj=arguments[i];if(obj!=null){forOwn(obj,copyProp,target);}}return target;}function copyProp(val,key){this[key]=val;}module.exports=mixIn;},{"./forOwn":70}],74:[function(require,module,exports){"use strict"
var hasOwn=require("mout/object/hasOwn"),mixIn=require("mout/object/mixIn"),create=require("mout/lang/createObject"),kindOf=require("mout/lang/kindOf")
var hasDescriptors=true
try{Object.defineProperty({},"~",{})
Object.getOwnPropertyDescriptor({},"~")}catch(e){hasDescriptors=false}var hasEnumBug=!({valueOf:0}).propertyIsEnumerable("valueOf"),buggy=["toString","valueOf"]
var verbs=/^constructor|inherits|mixin$/
var implement=function(proto){var prototype=this.prototype
for(var key in proto){if(key.match(verbs))continue
if(hasDescriptors){var descriptor=Object.getOwnPropertyDescriptor(proto,key)
if(descriptor){Object.defineProperty(prototype,key,descriptor)
continue}}prototype[key]=proto[key]}if(hasEnumBug)for(var i=0;(key=buggy[i]);i++){var value=proto[key]
if(value!==Object.prototype[key])prototype[key]=value}return this}
var prime=function(proto){if(kindOf(proto)==="Function")proto={constructor:proto}
var superprime=proto.inherits
var constructor=(hasOwn(proto,"constructor"))?proto.constructor:(superprime)?function(){return superprime.apply(this,arguments)}:function(){}
if(superprime){mixIn(constructor,superprime)
var superproto=superprime.prototype
var cproto=constructor.prototype=create(superproto)
constructor.parent=superproto
cproto.constructor=constructor}if(!constructor.implement)constructor.implement=implement
var mixins=proto.mixin
if(mixins){if(kindOf(mixins)!=="Array")mixins=[mixins]
for(var i=0;i<mixins.length;i++)constructor.implement(create(mixins[i].prototype))}return constructor.implement(proto)}
module.exports=prime},{"mout/lang/createObject":75,"mout/lang/kindOf":76,"mout/object/hasOwn":79,"mout/object/mixIn":80}],75:[function(require,module,exports){var mixIn=require('../object/mixIn');function createObject(parent,props){function F(){}F.prototype=parent;return mixIn(new F(),props);}module.exports=createObject;},{"../object/mixIn":80}],76:[function(require,module,exports){arguments[4][25][0].apply(exports,arguments)},{"dup":25}],77:[function(require,module,exports){arguments[4][28][0].apply(exports,arguments)},{"./hasOwn":79,"dup":28}],78:[function(require,module,exports){arguments[4][29][0].apply(exports,arguments)},{"./forIn":77,"./hasOwn":79,"dup":29}],79:[function(require,module,exports){arguments[4][30][0].apply(exports,arguments)},{"dup":30}],80:[function(require,module,exports){arguments[4][73][0].apply(exports,arguments)},{"./forOwn":78,"dup":73}],81:[function(require,module,exports){"use strict";var prime=require("prime")
var bind=require("mout/function/bind")
var bound=prime({bound:function(name){var bound=this._bound||(this._bound={})
return bound[name]||(bound[name]=bind(this[name],this))}})
module.exports=bound},{"mout/function/bind":62,"prime":74}],82:[function(require,module,exports){"use strict";var prime=require("prime")
var merge=require("mout/object/merge")
var Options=prime({setOptions:function(options){var args=[{},this.options]
args.push.apply(args,arguments)
this.options=merge.apply(null,args)
return this}})
module.exports=Options},{"mout/object/merge":72,"prime":74}],83:[function(require,module,exports){(function(process,global,setImmediate){(function(){"use strict"
var kindOf=require("mout/lang/kindOf"),now=require("mout/time/now"),forEach=require("mout/array/forEach"),indexOf=require("mout/array/indexOf")
var callbacks={timeout:{},frame:[],immediate:[]}
var push=function(collection,callback,context,defer){var iterator=function(){iterate(collection)}
if(!collection.length)defer(iterator)
var entry={callback:callback,context:context}
collection.push(entry)
return function(){var io=indexOf(collection,entry)
if(io>-1)collection.splice(io,1)}}
var iterate=function(collection){var time=now()
forEach(collection.splice(0),function(entry){entry.callback.call(entry.context,time)})}
var defer=function(callback,argument,context){return(kindOf(argument)==="Number")?defer.timeout(callback,argument,context):defer.immediate(callback,argument)}
if(global.process&&process.nextTick){defer.immediate=function(callback,context){return push(callbacks.immediate,callback,context,process.nextTick)}}else if(global.setImmediate){defer.immediate=function(callback,context){return push(callbacks.immediate,callback,context,setImmediate)}}else if(global.postMessage&&global.addEventListener){addEventListener("message",function(event){if(event.source===global&&event.data==="@deferred"){event.stopPropagation()
iterate(callbacks.immediate)}},true)
defer.immediate=function(callback,context){return push(callbacks.immediate,callback,context,function(){postMessage("@deferred","*")})}}else{defer.immediate=function(callback,context){return push(callbacks.immediate,callback,context,function(iterator){setTimeout(iterator,0)})}}var requestAnimationFrame=global.requestAnimationFrame||global.webkitRequestAnimationFrame||global.mozRequestAnimationFrame||global.oRequestAnimationFrame||global.msRequestAnimationFrame||function(callback){setTimeout(callback,1e3/60)}
defer.frame=function(callback,context){return push(callbacks.frame,callback,context,requestAnimationFrame)}
var clear
defer.timeout=function(callback,ms,context){var ct=callbacks.timeout
if(!clear)clear=defer.immediate(function(){clear=null
callbacks.timeout={}})
return push(ct[ms]||(ct[ms]=[]),callback,context,function(iterator){setTimeout(iterator,ms)})}
module.exports=defer}).call(this)}).call(this,require('_process'),typeof global!=="undefined"?global:typeof self!=="undefined"?self:typeof window!=="undefined"?window:{},require("timers").setImmediate)},{"_process":99,"mout/array/forEach":87,"mout/array/indexOf":88,"mout/lang/kindOf":90,"mout/time/now":95,"timers":100}],84:[function(require,module,exports){"use strict"
var indexOf=require("mout/array/indexOf"),forEach=require("mout/array/forEach")
var prime=require("./index"),defer=require("./defer")
var slice=Array.prototype.slice;var Emitter=prime({constructor:function(stoppable){this._stoppable=stoppable},on:function(event,fn){var listeners=this._listeners||(this._listeners={}),events=listeners[event]||(listeners[event]=[])
if(indexOf(events,fn)===-1)events.push(fn)
return this},off:function(event,fn){var listeners=this._listeners,events
if(listeners&&(events=listeners[event])){var io=indexOf(events,fn)
if(io>-1)events.splice(io,1)
if(!events.length)delete listeners[event];for(var l in listeners)return this
delete this._listeners}return this},emit:function(event){var self=this,args=slice.call(arguments,1)
var emit=function(){var listeners=self._listeners,events
if(listeners&&(events=listeners[event])){forEach(events.slice(0),function(event){var result=event.apply(self,args)
if(self._stoppable)return result})}}
if(args[args.length-1]===Emitter.EMIT_SYNC){args.pop()
emit()}else{defer(emit)}return this}})
Emitter.EMIT_SYNC={}
module.exports=Emitter},{"./defer":83,"./index":85,"mout/array/forEach":87,"mout/array/indexOf":88}],85:[function(require,module,exports){"use strict"
var hasOwn=require("mout/object/hasOwn"),mixIn=require("mout/object/mixIn"),create=require("mout/lang/createObject"),kindOf=require("mout/lang/kindOf")
var hasDescriptors=true
try{Object.defineProperty({},"~",{})
Object.getOwnPropertyDescriptor({},"~")}catch(e){hasDescriptors=false}var hasEnumBug=!({valueOf:0}).propertyIsEnumerable("valueOf"),buggy=["toString","valueOf"]
var verbs=/^constructor|inherits|mixin$/
var implement=function(proto){var prototype=this.prototype
for(var key in proto){if(key.match(verbs))continue
if(hasDescriptors){var descriptor=Object.getOwnPropertyDescriptor(proto,key)
if(descriptor){Object.defineProperty(prototype,key,descriptor)
continue}}prototype[key]=proto[key]}if(hasEnumBug)for(var i=0;(key=buggy[i]);i++){var value=proto[key]
if(value!==Object.prototype[key])prototype[key]=value}return this}
var prime=function(proto){if(kindOf(proto)==="Function")proto={constructor:proto}
var superprime=proto.inherits
var constructor=(hasOwn(proto,"constructor"))?proto.constructor:(superprime)?function(){return superprime.apply(this,arguments)}:function(){}
if(superprime){mixIn(constructor,superprime)
var superproto=superprime.prototype
var cproto=constructor.prototype=create(superproto)
constructor.parent=superproto
cproto.constructor=constructor}if(!constructor.implement)constructor.implement=implement
var mixins=proto.mixin
if(mixins){if(kindOf(mixins)!=="Array")mixins=[mixins]
for(var i=0;i<mixins.length;i++)constructor.implement(create(mixins[i].prototype))}return constructor.implement(proto)}
module.exports=prime},{"mout/lang/createObject":89,"mout/lang/kindOf":90,"mout/object/hasOwn":93,"mout/object/mixIn":94}],86:[function(require,module,exports){"use strict"
var indexOf=require("mout/array/indexOf")
var prime=require("./index")
var Map=prime({constructor:function Map(){this.length=0
this._values=[]
this._keys=[]},set:function(key,value){var index=indexOf(this._keys,key)
if(index===-1){this._keys.push(key)
this._values.push(value)
this.length++}else{this._values[index]=value}return this},get:function(key){var index=indexOf(this._keys,key)
return(index===-1)?null:this._values[index]},count:function(){return this.length},forEach:function(method,context){for(var i=0,l=this.length;i<l;i++){if(method.call(context,this._values[i],this._keys[i],this)===false)break}return this},map:function(method,context){var results=new Map
this.forEach(function(value,key){results.set(key,method.call(context,value,key,this))},this)
return results},filter:function(method,context){var results=new Map
this.forEach(function(value,key){if(method.call(context,value,key,this))results.set(key,value)},this)
return results},every:function(method,context){var every=true
this.forEach(function(value,key){if(!method.call(context,value,key,this))return(every=false)},this)
return every},some:function(method,context){var some=false
this.forEach(function(value,key){if(method.call(context,value,key,this))return!(some=true)},this)
return some},indexOf:function(value){var index=indexOf(this._values,value)
return(index>-1)?this._keys[index]:null},remove:function(value){var index=indexOf(this._values,value)
if(index!==-1){this._values.splice(index,1)
this.length--
return this._keys.splice(index,1)[0]}return null},unset:function(key){var index=indexOf(this._keys,key)
if(index!==-1){this._keys.splice(index,1)
this.length--
return this._values.splice(index,1)[0]}return null},keys:function(){return this._keys.slice()},values:function(){return this._values.slice()}})
var map=function(){return new Map}
map.prototype=Map.prototype
module.exports=map},{"./index":85,"mout/array/indexOf":88}],87:[function(require,module,exports){arguments[4][16][0].apply(exports,arguments)},{"dup":16}],88:[function(require,module,exports){arguments[4][17][0].apply(exports,arguments)},{"dup":17}],89:[function(require,module,exports){arguments[4][75][0].apply(exports,arguments)},{"../object/mixIn":94,"dup":75}],90:[function(require,module,exports){arguments[4][25][0].apply(exports,arguments)},{"dup":25}],91:[function(require,module,exports){arguments[4][28][0].apply(exports,arguments)},{"./hasOwn":93,"dup":28}],92:[function(require,module,exports){arguments[4][29][0].apply(exports,arguments)},{"./forIn":91,"./hasOwn":93,"dup":29}],93:[function(require,module,exports){arguments[4][30][0].apply(exports,arguments)},{"dup":30}],94:[function(require,module,exports){arguments[4][73][0].apply(exports,arguments)},{"./forOwn":92,"dup":73}],95:[function(require,module,exports){function now(){return now.get();}now.get=(typeof Date.now==='function')?Date.now:function(){return+(new Date());};module.exports=now;},{}],96:[function(require,module,exports){"use strict"
var parse=require("./parser")
var index=0,counter=document.__counter=(parseInt(document.__counter||-1,36)+1).toString(36),key="uid:"+counter
var uniqueID=function(n,xml){if(n===window)return"window"
if(n===document)return"document"
if(n===document.documentElement)return"html"
if(xml){var uid=n.getAttribute(key)
if(!uid){uid=(index++).toString(36)
n.setAttribute(key,uid)}return uid}else{return n[key]||(n[key]=(index++).toString(36))}}
var uniqueIDXML=function(n){return uniqueID(n,true)}
var isArray=Array.isArray||function(object){return Object.prototype.toString.call(object)==="[object Array]"}
var uniqueIndex=0;var HAS={GET_ELEMENT_BY_ID:function(test,id){id="slick_"+(uniqueIndex++);test.innerHTML='<a id="'+id+'"></a>'
return!!this.getElementById(id)},QUERY_SELECTOR:function(test){test.innerHTML='_<style>:nth-child(2){}</style>'
test.innerHTML='<a class="MiX"></a>'
return test.querySelectorAll('.MiX').length===1},EXPANDOS:function(test,id){id="slick_"+(uniqueIndex++);test._custom_property_=id
return test._custom_property_===id},MATCHES_SELECTOR:function(test){test.className="MiX"
var matches=test.matchesSelector||test.mozMatchesSelector||test.webkitMatchesSelector
if(matches)try{matches.call(test,':slick')}catch(e){return matches.call(test,".MiX")?matches:false}return false},GET_ELEMENTS_BY_CLASS_NAME:function(test){test.innerHTML='<a class="f"></a><a class="b"></a>'
if(test.getElementsByClassName('b').length!==1)return false
test.firstChild.className='b'
if(test.getElementsByClassName('b').length!==2)return false
test.innerHTML='<a class="a"></a><a class="f b a"></a>'
if(test.getElementsByClassName('a').length!==2)return false
return true},GET_ATTRIBUTE:function(test){var shout="fus ro dah"
test.innerHTML='<a class="'+shout+'"></a>'
return test.firstChild.getAttribute('class')===shout}}
var Finder=function Finder(document){this.document=document
var root=this.root=document.documentElement
this.tested={}
this.uniqueID=this.has("EXPANDOS")?uniqueID:uniqueIDXML
this.getAttribute=(this.has("GET_ATTRIBUTE"))?function(node,name){return node.getAttribute(name)}:function(node,name){node=node.getAttributeNode(name)
return(node&&node.specified)?node.value:null}
this.hasAttribute=(root.hasAttribute)?function(node,attribute){return node.hasAttribute(attribute)}:function(node,attribute){node=node.getAttributeNode(attribute)
return!!(node&&node.specified)}
this.contains=(document.contains&&root.contains)?function(context,node){return context.contains(node)}:(root.compareDocumentPosition)?function(context,node){return context===node||!!(context.compareDocumentPosition(node)&16)}:function(context,node){do{if(node===context)return true}while((node=node.parentNode))return false}
this.sorter=(root.compareDocumentPosition)?function(a,b){if(!a.compareDocumentPosition||!b.compareDocumentPosition)return 0
return a.compareDocumentPosition(b)&4?-1:a===b?0:1}:('sourceIndex'in root)?function(a,b){if(!a.sourceIndex||!b.sourceIndex)return 0
return a.sourceIndex-b.sourceIndex}:(document.createRange)?function(a,b){if(!a.ownerDocument||!b.ownerDocument)return 0
var aRange=a.ownerDocument.createRange(),bRange=b.ownerDocument.createRange()
aRange.setStart(a,0)
aRange.setEnd(a,0)
bRange.setStart(b,0)
bRange.setEnd(b,0)
return aRange.compareBoundaryPoints(Range.START_TO_END,bRange)}:null
this.failed={}
var nativeMatches=this.has("MATCHES_SELECTOR")
if(nativeMatches)this.matchesSelector=function(node,expression){if(this.failed[expression])return null
try{return nativeMatches.call(node,expression)}catch(e){if(slick.debug)console.warn("matchesSelector failed on "+expression)
this.failed[expression]=true
return null}}
if(this.has("QUERY_SELECTOR")){this.querySelectorAll=function(node,expression){if(this.failed[expression])return true
var result,_id,_expression,_combinator,_node
if(node!==this.document){_combinator=expression[0].combinator
_id=node.getAttribute("id")
_expression=expression
if(!_id){_node=node
_id="__slick__"
_node.setAttribute("id",_id)}expression="#"+_id+" "+_expression
if(_combinator.indexOf("~")>-1||_combinator.indexOf("+")>-1){node=node.parentNode
if(!node)result=true}}if(!result)try{result=node.querySelectorAll(expression.toString())}catch(e){if(slick.debug)console.warn("querySelectorAll failed on "+(_expression||expression))
result=this.failed[_expression||expression]=true}if(_node)_node.removeAttribute("id")
return result}}}
Finder.prototype.has=function(FEATURE){var tested=this.tested,testedFEATURE=tested[FEATURE]
if(testedFEATURE!=null)return testedFEATURE
var root=this.root,document=this.document,testNode=document.createElement("div")
testNode.setAttribute("style","display: none;")
root.appendChild(testNode)
var TEST=HAS[FEATURE],result=false
if(TEST)try{result=TEST.call(document,testNode)}catch(e){}if(slick.debug&&!result)console.warn("document has no "+FEATURE)
root.removeChild(testNode)
return tested[FEATURE]=result}
var combinators={" ":function(node,part,push){var item,items
var noId=!part.id,noTag=!part.tag,noClass=!part.classes
if(part.id&&node.getElementById&&this.has("GET_ELEMENT_BY_ID")){item=node.getElementById(part.id)
if(item&&item.getAttribute('id')===part.id){items=[item]
noId=true
if(part.tag==="*")noTag=true}}if(!items){if(part.classes&&node.getElementsByClassName&&this.has("GET_ELEMENTS_BY_CLASS_NAME")){items=node.getElementsByClassName(part.classList)
noClass=true
if(part.tag==="*")noTag=true}else{items=node.getElementsByTagName(part.tag)
if(part.tag!=="*")noTag=true}if(!items||!items.length)return false}for(var i=0;item=items[i++];)if((noTag&&noId&&noClass&&!part.attributes&&!part.pseudos)||this.match(item,part,noTag,noId,noClass))push(item)
return true},">":function(node,part,push){if((node=node.firstChild))do{if(node.nodeType==1&&this.match(node,part))push(node)}while((node=node.nextSibling))},"+":function(node,part,push){while((node=node.nextSibling))if(node.nodeType==1){if(this.match(node,part))push(node)
break}},"^":function(node,part,push){node=node.firstChild
if(node){if(node.nodeType===1){if(this.match(node,part))push(node)}else{combinators['+'].call(this,node,part,push)}}},"~":function(node,part,push){while((node=node.nextSibling)){if(node.nodeType===1&&this.match(node,part))push(node)}},"++":function(node,part,push){combinators['+'].call(this,node,part,push)
combinators['!+'].call(this,node,part,push)},"~~":function(node,part,push){combinators['~'].call(this,node,part,push)
combinators['!~'].call(this,node,part,push)},"!":function(node,part,push){while((node=node.parentNode))if(node!==this.document&&this.match(node,part))push(node)},"!>":function(node,part,push){node=node.parentNode
if(node!==this.document&&this.match(node,part))push(node)},"!+":function(node,part,push){while((node=node.previousSibling))if(node.nodeType==1){if(this.match(node,part))push(node)
break}},"!^":function(node,part,push){node=node.lastChild
if(node){if(node.nodeType==1){if(this.match(node,part))push(node)}else{combinators['!+'].call(this,node,part,push)}}},"!~":function(node,part,push){while((node=node.previousSibling)){if(node.nodeType===1&&this.match(node,part))push(node)}}}
Finder.prototype.search=function(context,expression,found){if(!context)context=this.document
else if(!context.nodeType&&context.document)context=context.document
var expressions=parse(expression)
if(!expressions||!expressions.length)throw new Error("invalid expression")
if(!found)found=[]
var uniques,push=isArray(found)?function(node){found[found.length]=node}:function(node){found[found.length++]=node}
if(expressions.length>1){uniques={}
var plush=push
push=function(node){var uid=uniqueID(node)
if(!uniques[uid]){uniques[uid]=true
plush(node)}}}var node,nodes,part
main:for(var i=0;expression=expressions[i++];){if(!slick.noQSA&&this.querySelectorAll){nodes=this.querySelectorAll(context,expression)
if(nodes!==true){if(nodes&&nodes.length)for(var j=0;node=nodes[j++];)if(node.nodeName>'@'){push(node)}continue main}}if(expression.length===1){part=expression[0]
combinators[part.combinator].call(this,context,part,push)}else{var cs=[context],c,f,u,p=function(node){var uid=uniqueID(node)
if(!u[uid]){u[uid]=true
f[f.length]=node}}
for(var j=0;part=expression[j++];){f=[];u={}
for(var k=0;c=cs[k++];)combinators[part.combinator].call(this,c,part,p)
if(!f.length)continue main
cs=f}if(i===0)found=f
else for(var l=0;l<f.length;l++)push(f[l])}}if(uniques&&found&&found.length>1)this.sort(found)
return found}
Finder.prototype.sort=function(nodes){return this.sorter?Array.prototype.sort.call(nodes,this.sorter):nodes}
var pseudos={'empty':function(){return!(this&&this.nodeType===1)&&!(this.innerText||this.textContent||'').length},'not':function(expression){return!slick.matches(this,expression)},'contains':function(text){return(this.innerText||this.textContent||'').indexOf(text)>-1},'first-child':function(){var node=this
while((node=node.previousSibling))if(node.nodeType==1)return false
return true},'last-child':function(){var node=this
while((node=node.nextSibling))if(node.nodeType==1)return false
return true},'only-child':function(){var prev=this
while((prev=prev.previousSibling))if(prev.nodeType==1)return false
var next=this
while((next=next.nextSibling))if(next.nodeType==1)return false
return true},'first-of-type':function(){var node=this,nodeName=node.nodeName
while((node=node.previousSibling))if(node.nodeName==nodeName)return false
return true},'last-of-type':function(){var node=this,nodeName=node.nodeName
while((node=node.nextSibling))if(node.nodeName==nodeName)return false
return true},'only-of-type':function(){var prev=this,nodeName=this.nodeName
while((prev=prev.previousSibling))if(prev.nodeName==nodeName)return false
var next=this
while((next=next.nextSibling))if(next.nodeName==nodeName)return false
return true},'enabled':function(){return!this.disabled},'disabled':function(){return this.disabled},'checked':function(){return this.checked||this.selected},'selected':function(){return this.selected},'focus':function(){var doc=this.ownerDocument
return doc.activeElement===this&&(this.href||this.type||slick.hasAttribute(this,'tabindex'))},'root':function(){return(this===this.ownerDocument.documentElement)}}
Finder.prototype.match=function(node,bit,noTag,noId,noClass){if(!slick.noQSA&&this.matchesSelector){var matches=this.matchesSelector(node,bit)
if(matches!==null)return matches}if(!noTag&&bit.tag){var nodeName=node.nodeName.toLowerCase()
if(bit.tag==="*"){if(nodeName<"@")return false}else if(nodeName!=bit.tag){return false}}if(!noId&&bit.id&&node.getAttribute('id')!==bit.id)return false
var i,part
if(!noClass&&bit.classes){var className=this.getAttribute(node,"class")
if(!className)return false
for(part in bit.classes)if(!RegExp('(^|\\s)'+bit.classes[part]+'(\\s|$)').test(className))return false}var name,value
if(bit.attributes)for(i=0;part=bit.attributes[i++];){var operator=part.operator,escaped=part.escapedValue
name=part.name
value=part.value
if(!operator){if(!this.hasAttribute(node,name))return false}else{var actual=this.getAttribute(node,name)
if(actual==null)return false
switch(operator){case'^=':if(!RegExp('^'+escaped).test(actual))return false;break
case'$=':if(!RegExp(escaped+'$').test(actual))return false;break
case'~=':if(!RegExp('(^|\\s)'+escaped+'(\\s|$)').test(actual))return false;break
case'|=':if(!RegExp('^'+escaped+'(-|$)').test(actual))return false;break
case'=':if(actual!==value)return false;break
case'*=':if(actual.indexOf(value)===-1)return false;break
default:return false}}}if(bit.pseudos)for(i=0;part=bit.pseudos[i++];){name=part.name
value=part.value
if(pseudos[name])return pseudos[name].call(node,value)
if(value!=null){if(this.getAttribute(node,name)!==value)return false}else{if(!this.hasAttribute(node,name))return false}}return true}
Finder.prototype.matches=function(node,expression){var expressions=parse(expression)
if(expressions.length===1&&expressions[0].length===1){return this.match(node,expressions[0][0])}if(!slick.noQSA&&this.matchesSelector){var matches=this.matchesSelector(node,expressions)
if(matches!==null)return matches}var nodes=this.search(this.document,expression,{length:0})
for(var i=0,res;res=nodes[i++];)if(node===res)return true
return false}
var finders={}
var finder=function(context){var doc=context||document
if(doc.ownerDocument)doc=doc.ownerDocument
else if(doc.document)doc=doc.document
if(doc.nodeType!==9)throw new TypeError("invalid document")
var uid=uniqueID(doc)
return finders[uid]||(finders[uid]=new Finder(doc))}
var slick=function(expression,context){return slick.search(expression,context)}
slick.search=function(expression,context,found){return finder(context).search(context,expression,found)}
slick.find=function(expression,context){return finder(context).search(context,expression)[0]||null}
slick.getAttribute=function(node,name){return finder(node).getAttribute(node,name)}
slick.hasAttribute=function(node,name){return finder(node).hasAttribute(node,name)}
slick.contains=function(context,node){return finder(context).contains(context,node)}
slick.matches=function(node,expression){return finder(node).matches(node,expression)}
slick.sort=function(nodes){if(nodes&&nodes.length>1)finder(nodes[0]).sort(nodes)
return nodes}
slick.parse=parse;module.exports=slick},{"./parser":98}],97:[function(require,module,exports){(function(global){(function(){"use strict"
module.exports="document"in global?require("./finder"):{parse:require("./parser")}}).call(this)}).call(this,typeof global!=="undefined"?global:typeof self!=="undefined"?self:typeof window!=="undefined"?window:{})},{"./finder":96,"./parser":98}],98:[function(require,module,exports){"use strict"
var escapeRe=/([-.*+?^${}()|[\]\/\\])/g,unescapeRe=/\\/g
var escape=function(string){return(string+"").replace(escapeRe,'\\$1')}
var unescape=function(string){return(string+"").replace(unescapeRe,'')}
var slickRe=RegExp("^(?:\\s*(,)\\s*|\\s*(<combinator>+)\\s*|(\\s+)|(<unicode>+|\\*)|\\#(<unicode>+)|\\.(<unicode>+)|\\[\\s*(<unicode1>+)(?:\\s*([*^$!~|]?=)(?:\\s*(?:([\"']?)(.*?)\\9)))?\\s*\\](?!\\])|(:+)(<unicode>+)(?:\\((?:(?:([\"'])([^\\13]*)\\13)|((?:\\([^)]+\\)|[^()]*)+))\\))?)".replace(/<combinator>/,'['+escape(">+~`!@$%^&={}\\;</")+']').replace(/<unicode>/g,'(?:[\\w\\u00a1-\\uFFFF-]|\\\\[^\\s0-9a-f])').replace(/<unicode1>/g,'(?:[:\\w\\u00a1-\\uFFFF-]|\\\\[^\\s0-9a-f])'))
var Part=function Part(combinator){this.combinator=combinator||" "
this.tag="*"}
Part.prototype.toString=function(){if(!this.raw){var xpr="",k,part
xpr+=this.tag||"*"
if(this.id)xpr+="#"+this.id
if(this.classes)xpr+="."+this.classList.join(".")
if(this.attributes)for(k=0;part=this.attributes[k++];){xpr+="["+part.name+(part.operator?part.operator+'"'+part.value+'"':'')+"]"}if(this.pseudos)for(k=0;part=this.pseudos[k++];){xpr+=":"+part.name
if(part.value)xpr+="("+part.value+")"}this.raw=xpr}return this.raw}
var Expression=function Expression(){this.length=0}
Expression.prototype.toString=function(){if(!this.raw){var xpr=""
for(var j=0,bit;bit=this[j++];){if(j!==1)xpr+=" "
if(bit.combinator!==" ")xpr+=bit.combinator+" "
xpr+=bit}this.raw=xpr}return this.raw}
var replacer=function(rawMatch,separator,combinator,combinatorChildren,tagName,id,className,attributeKey,attributeOperator,attributeQuote,attributeValue,pseudoMarker,pseudoClass,pseudoQuote,pseudoClassQuotedValue,pseudoClassValue){var expression,current
if(separator||!this.length){expression=this[this.length++]=new Expression
if(separator)return''}if(!expression)expression=this[this.length-1]
if(combinator||combinatorChildren||!expression.length){current=expression[expression.length++]=new Part(combinator)}if(!current)current=expression[expression.length-1]
if(tagName){current.tag=unescape(tagName)}else if(id){current.id=unescape(id)}else if(className){var unescaped=unescape(className)
var classes=current.classes||(current.classes={})
if(!classes[unescaped]){classes[unescaped]=escape(className)
var classList=current.classList||(current.classList=[])
classList.push(unescaped)
classList.sort()}}else if(pseudoClass){pseudoClassValue=pseudoClassValue||pseudoClassQuotedValue;(current.pseudos||(current.pseudos=[])).push({type:pseudoMarker.length==1?'class':'element',name:unescape(pseudoClass),escapedName:escape(pseudoClass),value:pseudoClassValue?unescape(pseudoClassValue):null,escapedValue:pseudoClassValue?escape(pseudoClassValue):null})}else if(attributeKey){attributeValue=attributeValue?escape(attributeValue):null;(current.attributes||(current.attributes=[])).push({operator:attributeOperator,name:unescape(attributeKey),escapedName:escape(attributeKey),value:attributeValue?unescape(attributeValue):null,escapedValue:attributeValue?escape(attributeValue):null})}return''}
var Expressions=function Expressions(expression){this.length=0
var self=this
var original=expression,replaced
while(expression){replaced=expression.replace(slickRe,function(){return replacer.apply(self,arguments)})
if(replaced===expression)throw new Error(original+' is an invalid expression')
expression=replaced}}
Expressions.prototype.toString=function(){if(!this.raw){var expressions=[]
for(var i=0,expression;expression=this[i++];)expressions.push(expression)
this.raw=expressions.join(", ")}return this.raw}
var cache={}
var parse=function(expression){if(expression==null)return null
expression=(''+expression).replace(/^\s+|\s+$/g,'')
return cache[expression]||(cache[expression]=new Expressions(expression))}
module.exports=parse},{}],99:[function(require,module,exports){var process=module.exports={};var cachedSetTimeout;var cachedClearTimeout;function defaultSetTimout(){throw new Error('setTimeout has not been defined');}function defaultClearTimeout(){throw new Error('clearTimeout has not been defined');}(function(){try{if(typeof setTimeout==='function'){cachedSetTimeout=setTimeout;}else{cachedSetTimeout=defaultSetTimout;}}catch(e){cachedSetTimeout=defaultSetTimout;}try{if(typeof clearTimeout==='function'){cachedClearTimeout=clearTimeout;}else{cachedClearTimeout=defaultClearTimeout;}}catch(e){cachedClearTimeout=defaultClearTimeout;}}())
function runTimeout(fun){if(cachedSetTimeout===setTimeout){return setTimeout(fun,0);}if((cachedSetTimeout===defaultSetTimout||!cachedSetTimeout)&&setTimeout){cachedSetTimeout=setTimeout;return setTimeout(fun,0);}try{return cachedSetTimeout(fun,0);}catch(e){try{return cachedSetTimeout.call(null,fun,0);}catch(e){return cachedSetTimeout.call(this,fun,0);}}}function runClearTimeout(marker){if(cachedClearTimeout===clearTimeout){return clearTimeout(marker);}if((cachedClearTimeout===defaultClearTimeout||!cachedClearTimeout)&&clearTimeout){cachedClearTimeout=clearTimeout;return clearTimeout(marker);}try{return cachedClearTimeout(marker);}catch(e){try{return cachedClearTimeout.call(null,marker);}catch(e){return cachedClearTimeout.call(this,marker);}}}var queue=[];var draining=false;var currentQueue;var queueIndex=-1;function cleanUpNextTick(){if(!draining||!currentQueue){return;}draining=false;if(currentQueue.length){queue=currentQueue.concat(queue);}else{queueIndex=-1;}if(queue.length){drainQueue();}}function drainQueue(){if(draining){return;}var timeout=runTimeout(cleanUpNextTick);draining=true;var len=queue.length;while(len){currentQueue=queue;queue=[];while(++queueIndex<len){if(currentQueue){currentQueue[queueIndex].run();}}queueIndex=-1;len=queue.length;}currentQueue=null;draining=false;runClearTimeout(timeout);}process.nextTick=function(fun){var args=new Array(arguments.length-1);if(arguments.length>1){for(var i=1;i<arguments.length;i++){args[i-1]=arguments[i];}}queue.push(new Item(fun,args));if(queue.length===1&&!draining){runTimeout(drainQueue);}};function Item(fun,array){this.fun=fun;this.array=array;}Item.prototype.run=function(){this.fun.apply(null,this.array);};process.title='browser';process.browser=true;process.env={};process.argv=[];process.version='';process.versions={};function noop(){}process.on=noop;process.addListener=noop;process.once=noop;process.off=noop;process.removeListener=noop;process.removeAllListeners=noop;process.emit=noop;process.prependListener=noop;process.prependOnceListener=noop;process.listeners=function(name){return[]}
process.binding=function(name){throw new Error('process.binding is not supported');};process.cwd=function(){return'/'};process.chdir=function(dir){throw new Error('process.chdir is not supported');};process.umask=function(){return 0;};},{}],100:[function(require,module,exports){(function(setImmediate,clearImmediate){(function(){var nextTick=require('process/browser.js').nextTick;var apply=Function.prototype.apply;var slice=Array.prototype.slice;var immediateIds={};var nextImmediateId=0;exports.setTimeout=function(){return new Timeout(apply.call(setTimeout,window,arguments),clearTimeout);};exports.setInterval=function(){return new Timeout(apply.call(setInterval,window,arguments),clearInterval);};exports.clearTimeout=exports.clearInterval=function(timeout){timeout.close();};function Timeout(id,clearFn){this._id=id;this._clearFn=clearFn;}Timeout.prototype.unref=Timeout.prototype.ref=function(){};Timeout.prototype.close=function(){this._clearFn.call(window,this._id);};exports.enroll=function(item,msecs){clearTimeout(item._idleTimeoutId);item._idleTimeout=msecs;};exports.unenroll=function(item){clearTimeout(item._idleTimeoutId);item._idleTimeout=-1;};exports._unrefActive=exports.active=function(item){clearTimeout(item._idleTimeoutId);var msecs=item._idleTimeout;if(msecs>=0){item._idleTimeoutId=setTimeout(function onTimeout(){if(item._onTimeout)item._onTimeout();},msecs);}};exports.setImmediate=typeof setImmediate==="function"?setImmediate:function(fn){var id=nextImmediateId++;var args=arguments.length<2?false:slice.call(arguments,1);immediateIds[id]=true;nextTick(function onNextTick(){if(immediateIds[id]){if(args){fn.apply(null,args);}else{fn.call(null);}exports.clearImmediate(id);}});return id;};exports.clearImmediate=typeof clearImmediate==="function"?clearImmediate:function(id){delete immediateIds[id];};}).call(this)}).call(this,require("timers").setImmediate,require("timers").clearImmediate)},{"process/browser.js":99,"timers":100}]},{},[1])