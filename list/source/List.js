/**
	_enyo.List_ is a control that displays a scrolling list of rows, suitable
	for displaying very large lists. It is optimized such that only a small
	portion of the list is rendered at a given time. A flyweight pattern is
	employed, in which controls placed inside the list are created once, but
	rendered for each list item. For this reason, it's best to use only simple
	controls in	a List, such as <a href="#enyo.Control">enyo.Control</a> and
	<a href="#enyo.Image">enyo.Image</a>.

	A List's _components_ block contains the controls to be used for a single
	row. This set of controls will be rendered for each row. You may customize
	row rendering by handling the _onSetupItem_ event.

	Events fired from within list rows contain the _index_ property, which may
	be used to identify the row	from which the event originated.

	The controls inside a List are non-interactive. This means that calling
	methods that would normally cause rendering to occur (e.g., _setContent_)
	will not do so. However, you can force a row to render by calling
	_renderRow(inRow)_.

	In addition, you can force a row to be temporarily interactive by calling
	_prepareRow(inRow)_. Call the _lockRow_ method when the interaction is
	complete.

	For more information, see the documentation on
	[Lists](https://github.com/enyojs/enyo/wiki/Lists)
	in the Enyo Developer Guide.
*/
enyo.kind({
	name: "enyo.List",
	kind: "Scroller",
	classes: "enyo-list",
	published: {
		/**
			The number of rows contained in the list. Note that as the amount of
			list data changes, _setRows_ can be called to adjust the number of
			rows. To re-render the list at the current position when the count
			has changed, call the _refresh_ method.  If the whole data model of
			the list has changed and you want to redisplay from the top, call
			the _reset_ method instead.
		*/
		count: 0,
		/**
			The number of rows to be shown on a given list page segment. 
			There is generally no need to adjust this value.
		*/
		rowsPerPage: 50,
		/**
			If true, renders the list such that row 0 is at the bottom of the
			viewport and the beginning position of the list is scrolled to the
			bottom
		*/
		bottomUp: false,
		/**
			If true, the selection mechanism is disabled. Tap events are still
			sent, but items won't be automatically re-rendered when tapped.
		*/
		noSelect: false,
		//* If true, multiple selections are allowed
		multiSelect: false,
		//* If true, the selected item will toggle
		toggleSelected: false,
		//* If true, the list will assume all rows have the same height for optimization
		fixedHeight: false,
		//* Array containing any swipeable components that will be used
		swipeableComponents: [],
		//* Enable/disable swipe functionality
		enableSwipe: false,
		//* Tell list to persist the current swipeable item
		persistSwipeableItem: false
	},
	events: {
		/**
			Fires once per row at render time.
			
			_inEvent.index_ contains the current row index.
		*/
		onSetupItem: "",
		onSetupSwipeItem: "",
		onSwipeDrag: "",
		onSwipe: "",
		onSwipeComplete: ""
	},
	handlers: {
		onAnimateFinish: "animateFinish",
		ondragstart: "dragstart",
        ondragfinish: "dragfinish",
        ondrag: "drag",
		onflick: "flick",
		onwebkitTransitionEnd: "transitionComplete"
	},
	//* @protected
	rowHeight: 0,
	listTools: [
		{name: "port", classes: "enyo-list-port enyo-border-box", components: [
			{name: "generator", kind: "FlyweightRepeater", canGenerate: false, components: [
				{tag: null, name: "client"}
			]},
			{name: "page0", allowHtml: true, classes: "enyo-list-page"},
			{name: "page1", allowHtml: true, classes: "enyo-list-page"},
			{name: "swipeableComponents", style: "position:absolute;display:block;top:-1000px;left:0px;"}
		]}
	],
	create: function() {
		this.pageHeights = [];
		this.inherited(arguments);
		this.getStrategy().translateOptimized = true;
		this.bottomUpChanged();
		this.noSelectChanged();
		this.multiSelectChanged();
		this.toggleSelectedChanged();
	},
	createStrategy: function() {
		this.controlParentName = "strategy";
		this.inherited(arguments);
		this.createChrome(this.listTools);
		this.controlParentName = "client";
		this.discoverControlParent();
	},
	initComponents: function() {
		this.inherited(arguments);
		this.createSwipeableComponents();
	},
	createSwipeableComponents: function() {
		for(var i=0;i<this.swipeableComponents.length;i++) {
			this.$.swipeableComponents.createComponent(this.swipeableComponents[i], {owner: this.owner});
		}
	},
	rendered: function() {
		this.inherited(arguments);
		this.$.generator.node = this.$.port.hasNode();
		this.$.generator.generated = true;
		this.reset();
	},
	resizeHandler: function() {
		this.inherited(arguments);
		this.refresh();
	},
	bottomUpChanged: function() {
		this.$.generator.bottomUp = this.bottomUp;
		this.$.page0.applyStyle(this.pageBound, null);
		this.$.page1.applyStyle(this.pageBound, null);
		this.pageBound = this.bottomUp ? "bottom" : "top";
		if (this.hasNode()) {
			this.reset();
		}
	},
	noSelectChanged: function() {
		this.$.generator.setNoSelect(this.noSelect);
	},
	multiSelectChanged: function() {
		this.$.generator.setMultiSelect(this.multiSelect);
	},
	toggleSelectedChanged: function() {
		this.$.generator.setToggleSelected(this.toggleSelected);
	},
	countChanged: function() {
		if (this.hasNode()) {
			this.updateMetrics();
		}
	},
	updateMetrics: function() {
		this.defaultPageHeight = this.rowsPerPage * (this.rowHeight || 100);
		this.pageCount = Math.ceil(this.count / this.rowsPerPage);
		this.portSize = 0;
		for (var i=0; i < this.pageCount; i++) {
			this.portSize += this.getPageHeight(i);
		}
		this.adjustPortSize();
	},
	generatePage: function(inPageNo, inTarget) {
		this.page = inPageNo;
		var r = this.$.generator.rowOffset = this.rowsPerPage * this.page;
		var rpp = this.$.generator.count = Math.min(this.count - r, this.rowsPerPage);
		var html = this.$.generator.generateChildHtml();
		inTarget.setContent(html);
		var pageHeight = inTarget.getBounds().height;
		// if rowHeight is not set, use the height from the first generated page
		if (!this.rowHeight && pageHeight > 0) {
			this.rowHeight = Math.floor(pageHeight / rpp);
			this.updateMetrics();
		}
		// update known page heights
		if (!this.fixedHeight) {
			var h0 = this.getPageHeight(inPageNo);
			if (h0 != pageHeight && pageHeight > 0) {
				this.pageHeights[inPageNo] = pageHeight;
				this.portSize += pageHeight - h0;
			}
		}
	},
	update: function(inScrollTop) {
		var updated = false;
		// get page info for position
		var pi = this.positionToPageInfo(inScrollTop);
		// zone line position
		var pos = pi.pos + this.scrollerHeight/2;
		// leap-frog zone position
		var k = Math.floor(pos/Math.max(pi.height, this.scrollerHeight) + 1/2) + pi.no;
		// which page number for page0 (even number pages)?
		var p = (k % 2 === 0) ? k : k-1;
		if (this.p0 != p && this.isPageInRange(p)) {
			//this.log("update page0", p);
			this.generatePage(p, this.$.page0);
			this.positionPage(p, this.$.page0);
			this.p0 = p;
			updated = true;
		}
		// which page number for page1 (odd number pages)?
		p = (k % 2 === 0) ? Math.max(1, k-1) : k;
		// position data page 1
		if (this.p1 != p && this.isPageInRange(p)) {
			//this.log("update page1", p);
			this.generatePage(p, this.$.page1);
			this.positionPage(p, this.$.page1);
			this.p1 = p;
			updated = true;
		}
		if (updated && !this.fixedHeight) {
			this.adjustBottomPage();
			this.adjustPortSize();
		}
	},
	updateForPosition: function(inPos) {
		this.update(this.calcPos(inPos));
	},
	calcPos: function(inPos) {
		return (this.bottomUp ? (this.portSize - this.scrollerHeight - inPos) : inPos);
	},
	adjustBottomPage: function() {
		var bp = this.p0 >= this.p1 ? this.$.page0 : this.$.page1;
		this.positionPage(bp.pageNo, bp);
	},
	adjustPortSize: function() {
		this.scrollerHeight = this.getBounds().height;
		var s = Math.max(this.scrollerHeight, this.portSize);
		this.$.port.applyStyle("height", s + "px");
	},
	positionPage: function(inPage, inTarget) {
		inTarget.pageNo = inPage;
		var y = this.pageToPosition(inPage);
		inTarget.applyStyle(this.pageBound, y + "px");
	},
	pageToPosition: function(inPage) {
		var y = 0;
		var p = inPage;
		while (p > 0) {
			p--;
			y += this.getPageHeight(p);
		}
		return y;
	},
	positionToPageInfo: function(inY) {
		var page = -1;
		var p = this.calcPos(inY);
		var h = this.defaultPageHeight;
		while (p >= 0) {
			page++;
			h = this.getPageHeight(page);
			p -= h;
		}
		//page = Math.min(page, this.pageCount-1);
		return {no: page, height: h, pos: p+h};
	},
	isPageInRange: function(inPage) {
		return inPage == Math.max(0, Math.min(this.pageCount-1, inPage));
	},
	getPageHeight: function(inPageNo) {
		return this.pageHeights[inPageNo] || this.defaultPageHeight;
	},
	invalidatePages: function() {
		this.p0 = this.p1 = null;
		// clear the html in our render targets
		this.$.page0.setContent("");
		this.$.page1.setContent("");
	},
	invalidateMetrics: function() {
		this.pageHeights = [];
		this.rowHeight = 0;
		this.updateMetrics();
	},
	scroll: function(inSender, inEvent) {
		var r = this.inherited(arguments);
		this.update(this.getScrollTop());
		return r;
	},
	//* @public
	scrollToBottom: function() {
		this.update(this.getScrollBounds().maxTop);
		this.inherited(arguments);
	},
	setScrollTop: function(inScrollTop) {
		this.update(inScrollTop);
		this.inherited(arguments);
		this.twiddle();
	},
	getScrollPosition: function() {
		return this.calcPos(this.getScrollTop());
	},
	setScrollPosition: function(inPos) {
		this.setScrollTop(this.calcPos(inPos));
	},
	//* Scrolls to a specific row.
	scrollToRow: function(inRow) {
		var page = Math.floor(inRow / this.rowsPerPage);
		var pageRow = inRow % this.rowsPerPage;
		var h = this.pageToPosition(page);
		// update the page
		this.updateForPosition(h);
		// call pageToPosition again and this time should return the g pos since the page info is populated
		h = this.pageToPosition(page);
		this.setScrollPosition(h);
		if (page == this.p0 || page == this.p1) {
			var rowNode = this.$.generator.fetchRowNode(inRow);
			if (rowNode) {
				// calc row offset
				var offset = rowNode.offsetTop;
				if (this.bottomUp) {
					offset = this.getPageHeight(page) - rowNode.offsetHeight - offset;
				}
				var y = this.getScrollPosition() + offset;
				this.setScrollPosition(y);
			}
		}
	},
	//* Scrolls to the beginning of the list.
	scrollToStart: function() {
		this[this.bottomUp ? "scrollToBottom" : "scrollToTop"]();
	},
	//* Scrolls to the end of the list.
	scrollToEnd: function() {
		this[this.bottomUp ? "scrollToTop" : "scrollToBottom"]();
	},
	//* Re-renders the list at the current position.
	refresh: function() {
		this.invalidatePages();
		this.update(this.getScrollTop());
		this.stabilize();

		//FIXME: Necessary evil for Android 4.0.4 refresh bug
		if (enyo.platform.android === 4) {
			this.twiddle();
		}
	},
	/**
		Re-renders the list from the beginning.  This is used when changing the
		data model for the list.  This will also clear the selection state.
	*/
	reset: function() {
		this.getSelection().clear();
		this.invalidateMetrics();
		this.invalidatePages();
		this.stabilize();
		this.scrollToStart();
	},
	/**
		Returns the [enyo.Selection](#enyo.Selection) component that 
		manages the selection state for	this list.
	*/
	getSelection: function() {
		return this.$.generator.getSelection();
	},
	/**
		Sets the selection state for the given row index.
		_inData_ is an optional data value stored in the selection object.

		Modifying selection will not automatically rerender the row, 
		so use [renderRow](#enyo.List::renderRow) or [refresh](#enyo.List::refresh)
		to update the view.
	*/
	select: function(inIndex, inData) {
		return this.getSelection().select(inIndex, inData);
	},
	/**
		Clears the selection state for the given row index.

		Modifying selection will not automatically rerender the row, 
		so use [renderRow](#enyo.List::renderRow) or [refresh](#enyo.List::refresh)
		to update the view.
	*/
	deselect: function(inIndex) {
		return this.getSelection().deselect(inIndex);
	},
	//* Gets the selection state for the given row index.
	isSelected: function(inIndex) {
		return this.$.generator.isSelected(inIndex);
	},
	/**
		Re-renders the specified row. Call after making modifications to a row,
		to force it to render.
	*/
	renderRow: function(inIndex) {
		this.$.generator.renderRow(inIndex);
	},
	//* Prepares the row to become interactive.
	prepareRow: function(inIndex) {
		this.$.generator.prepareRow(inIndex);
	},
	//* Restores the row to being non-interactive.
	lockRow: function() {
		this.$.generator.lockRow();
	},
	/**
		Performs a set of tasks by running the function _inFunc_ on a row (which
		must be interactive at the time the tasks are performed). Locks the	row
		when done.
	*/
	performOnRow: function(inIndex, inFunc, inContext) {
		this.$.generator.performOnRow(inIndex, inFunc, inContext);
	},
	//* @protected
	animateFinish: function(inSender) {
		this.twiddle();
		return true;
	},
	// FIXME: Android 4.04 has issues with nested composited elements; for example, a SwipeableItem, 
	// can incorrectly generate taps on its content when it has slid off the screen;
	// we address this BUG here by forcing the Scroller to "twiddle" which corrects the bug by
	// provoking a dom update.
	twiddle: function() {
		var s = this.getStrategy();
		enyo.call(s, "twiddle");
	},
	
	
	// index of swiped item
	swipeIndex: null,
	// direction of swipe
	swipeDirection: null,
	// is a persistent item currently persisting
	persistentItemVisisble: false,
	// side from which the persisting item came from
	persistentItemOrigin: null,
	// specify if swipe was completed
	swipeComplete: false,
	// timeout used to wait before completing swipe action
	completeSwipeTimeout: null,
	// time in MS to wait before completing swipe action
	completeSwipeDelayMS: 150,
	// time in seconds for normal swipe animation
	normalSwipeSpeed: 0.2,
	// time in seconds for fast swipe animation
	fastSwipeSpeed: 0.1,
	// flag to specify whether a flick event happened
	flicked: false,
	// percentage of a swipe needed to force complete the swipe
	percentageDraggedThreshold: 0.2,
	
	/*
		When a drag starts, get the direction of the drag as well as the index of the item
		being dragged, and reset any pertinent values. Then kick off the swipe sequence.
	*/
	dragstart: function(inSender, inEvent) {
		// if no swipeable components are defined, or vertical drag, don't do swipe actions
		if(!this.hasSwipeableComponents() || inEvent.vertical) {
			return this.preventDragPropagation;
		}
		
		// save direction we are swiping
		this.setSwipeDirection(inEvent.xDirection);
		
		// if we are waiting to complete a swipe, complete it
		if(this.completeSwipeTimeout) {
			this.completeSwipe(inEvent);
		}
		
		// reset flicked flag
		this.setFlicked(false);
		// reset swipe complete flag
		this.setSwipeComplete(false);
		
		// if user is dragging a different item than was dragged previously, hide all swipeables first
		if(this.swipeIndexChanged(inEvent.index)) {
			this.clearSwipeables();
			this.setSwipeIndex(inEvent.index);
		}
		
		// start swipe sequence only if we are not currently showing a persistent item
		if(!this.persistentItemVisisble) {
			this.startSwipe(inEvent);
		}
		
		return this.preventDragPropagation;
	},
	/*
		When a drag is in progress, update the position of the swipeable container based on
		the ddx of the event.
	*/
	drag: function(inSender, inEvent) {
		// if swiping is disabled, return early
		if(!this.getEnableSwipe()) {
			return this.preventDragPropagation;
		}
		
		// if a persistent swipeableItem is still showing, handle it separately
		if(this.persistentItemVisisble) {
			this.dragPersistentItem(inEvent);
			return this.preventDragPropagation;
		}
		
		// apply new position
		this.dragSwipeableComponents(this.calcNewDragPosition(inEvent.ddx));
		
		return this.preventDragPropagation;
	},
	/*
		When the user flicks, complete the swipe.
	*/
	flick: function(inSender, inEvent) {
		// if swiping is disabled, return early
		if(!this.getEnableSwipe()) {
			return this.preventDragPropagation;
		}
		
		// if the flick was vertical, return early
		if(Math.abs(inEvent.xVelocity) < Math.abs(inEvent.yVelocity)) {
			return this.preventDragPropagation;
		}
		
		// prevent the dragFinish event from breaking the flick
		this.setFlicked(true);
		
		// if a persistent swipeableItem is still showing, slide it away or bounce it
		if(this.persistentItemVisisble) {
			this.flickPersistentItem(inEvent);
			return this.preventDragPropagation;
		}
		
		// do swipe
		this.swipe(inEvent,this.normalSwipeSpeed);
		
		return this.preventDragPropagation;
	},
	/*
		When the current drag completes, decide whether to complete the swipe based on
		how far the user pulled the swipeable container. If a flick occurred, don't
		process dragFinish.
	*/
	dragfinish: function(inSender, inEvent) {
		// if swiping is disabled, return early
		if(!this.getEnableSwipe()) {
			return this.preventDragPropagation;
		}
		// if a flick happened, don't do dragFinish
		if(this.wasFlicked()) {
			return this.preventDragPropagation;
		}
		
		// if a persistent swipeableItem is still showing, complete drag away or bounce
		if(this.persistentItemVisisble) {
			this.dragFinishPersistentItem(inEvent);
		// otherwise if user dragged more than 20% of the width, complete the swipe. if not, back out.
		} else {
			if(this.calcPercentageDragged(inEvent.dx) > this.percentageDraggedThreshold) {
				this.swipe(inEvent,this.fastSwipeSpeed);
			} else {
				this.backOutSwipe(inEvent);
			}
		}
		
		return this.preventDragPropagation;
	},
	
	hasSwipeableComponents: function() {
		return this.$.swipeableComponents.controls.length != 0;
	},
	// Position the swipeable components block at the current row
	positionSwipeableContainer: function(index,xDirection) {
		var node = this.$.generator.fetchRowNode(index);
		if(!node) {
			return;
		}
		var offset = this.getRelativeOffset(node, this.hasNode());
		var dimensions = this.getDimensions(node);
		var x = (xDirection == 1) ? -1*parseInt(dimensions.width) : parseInt(dimensions.width);
		this.$.swipeableComponents.addStyles("top: "+offset.top+"px; -webkit-transform: translate3d("+x+"px,0,0); height: "+dimensions.height+"; width: "+dimensions.width);
	},
	// Get offset relative to a positioned ancestor node
    getRelativeOffset: function (n, p) {
        var ro = {top: 0, left: 0};
        if (n !== p && n.parentNode) {
            do {
                ro.top += n.offsetTop || 0;
                ro.left += n.offsetLeft || 0;
                n = n.offsetParent;
            } while (n && n !== p);
        }
        return ro;
    },
	// Get height and width dimensions of the given dom node
	getDimensions: function(node) {
		var style = getComputedStyle(node,null);
		var h = style.getPropertyValue("height");
		var w = style.getPropertyValue("width");
		return {height: h, width: w};
	},
	setSwipeDirection: function(xDirection) {
		this.swipeDirection = xDirection;
	},
	setFlicked: function(flicked) {
		this.flicked = flicked;
	},
	wasFlicked: function() {
		return this.flicked;
	},
	setSwipeComplete: function(complete) {
		this.swipeComplete = complete;
	},
	swipeIndexChanged: function(index) {
		return (this.swipeIndex === null) ? true : (index === undefined) ? false : (index !== this.swipeIndex);
	},
	setSwipeIndex: function(index) {
		this.swipeIndex = (index === undefined) ? this.swipeIndex : index;
	},
	/*
		Calculate new position for the swipeable container based on the user's drag action. Don't
		allow the container to drag further than either edge.
	*/
	calcNewDragPosition: function(dx) {
		var parentStyle = getComputedStyle(this.$.swipeableComponents.node);
		var xPos = parseInt(parentStyle.webkitTransform.split(",")[4]);
		var dimensions = this.getDimensions(this.$.swipeableComponents.node);
		var xlimit = (this.swipeDirection == 1) ? -1*parseInt(dimensions.width) : parseInt(dimensions.width);
		var x = (this.swipeDirection == 1)
			? (xPos + dx < xlimit)
				? xlimit
				: xPos + dx
			: (xPos + dx > xlimit)
				? xlimit
				: xPos + dx;
		return x;
	},
	dragSwipeableComponents: function(x) {
		this.$.swipeableComponents.applyStyle("-webkit-transform","translate3d("+x+"px,0,0)");
	},
	// Begin swiping sequence by positioning the swipeable container and bubbling the setupSwipeItem event
	startSwipe: function(e) {
		this.positionSwipeableContainer(this.swipeIndex,e.xDirection);
		this.$.swipeableComponents.setShowing(true);
		this.setPersistentItemOrigin(e.xDirection);
		this.doSetupSwipeItem(e);
	},
	// if a persistent swipeableItem is still showing, drag it away or bounce it
	dragPersistentItem: function(e) {
		var xPos = 0;
		var x = (this.persistentItemOrigin == "right")
			? Math.max(xPos, (xPos + e.dx))
			: Math.min(xPos, (xPos + e.dx));
		this.$.swipeableComponents.applyStyle("-webkit-transform","translate3d("+x+"px,0,0)");
	},
	// if a persistent swipeableItem is still showing, complete drag away or bounce
	dragFinishPersistentItem: function(e) {
		var completeSwipe = (this.calcPercentageDragged(e.dx) > 0.2);
		var dir = (e.dx > 0) ? "right" : (e.dx < 0) ? "left" : null;
		if(this.persistentItemOrigin == dir) {
			if(completeSwipe) {
				this.slideAwayItem();
			} else {
				this.bounceItem(e);
			}
		} else {
			this.bounceItem(e);
		}
	},
	// if a persistent swipeableItem is still showing, slide it away or bounce it
	flickPersistentItem: function(e) {
		if(e.xVelocity > 0) {
			if(this.persistentItemOrigin == "left") {
				this.bounceItem(e);
			} else {
				this.slideAwayItem();
			}
		} else if(e.xVelocity < 0) {
			if(this.persistentItemOrigin == "right") {
				this.bounceItem(e);
			} else {
				this.slideAwayItem();
			}
		}
	},
	setPersistentItemOrigin: function(xDirection) {
		this.persistentItemOrigin = xDirection == 1 ? "left" : "right";
	},
	calcPercentageDragged: function(dx) {
		return Math.abs(dx/parseInt(getComputedStyle(this.$.swipeableComponents.node).width));
	},
	swipe: function(e,speed) {
		this.setSwipeComplete(true);
		this.swipeItem(0,speed,e);
	},
	backOutSwipe: function(e) {
		var dimensions = this.getDimensions(this.$.swipeableComponents.node);
		var x = (this.swipeDirection == 1) ? -1*parseInt(dimensions.width) : parseInt(dimensions.width);
		this.swipeItem(x,0.1,e);
	},
	swipeItem: function(x,secs,e) {
		var $item = this.$.swipeableComponents;
		$item.applyStyle("-webkit-transition", "-webkit-transform "+secs+"s linear 0s");
		$item.applyStyle("-webkit-transform","translate3d("+x+"px,0,0)");
	},
	bounceItem: function(e) {
		if(parseInt(getComputedStyle(this.$.swipeableComponents.node).webkitTransform.split(",")[4]) != 0) {
			this.swipeItem(0,this.normalSwipeSpeedSecs,e);
		}
	},
	slideAwayItem: function() {
		var $item = this.$.swipeableComponents;
		var parentStyle = getComputedStyle($item.node);
		var xPos = (this.persistentItemOrigin == "right") ? parseInt(parentStyle.width) : -1*parseInt(parentStyle.width);
		$item.applyStyle("-webkit-transition", "-webkit-transform "+this.normalSwipeSpeedSecs+"s linear 0s");
		$item.applyStyle("-webkit-transform","translate3d("+xPos+"px,0,0)");
		this.persistentItemVisisble = false;
		this.setPersistSwipeableItem(false);
	},
	resetSwipeableTransitionTime: function($item) {
		this.$.swipeableComponents.applyStyle("-webkit-transition", "-webkit-transform 0s linear 0s");
	},
	clearSwipeables: function() {
		this.$.swipeableComponents.setShowing(false);
		this.persistentItemVisisble = false;
		this.setPersistSwipeableItem(false);
	},
	/*
		When the CSS transition for the swipeable animation has completed, wait for a defined timeout
		before processing the swipe completion.
	*/
	transitionComplete: function(inSender, inEvent) {
		if(inEvent.originator.name !== "swipeableComponents") {
			return;
		}
		var _this = this;
		this.completeSwipeTimeout = setTimeout(function() { _this.completeSwipe(inEvent); }, this.completeSwipeDelayMS);
	},
	// complete swipe and hide active swipeable item
	completeSwipe: function(e) {
		if(this.completeSwipeTimeout) {
			clearTimeout(this.completeSwipeTimeout);
			this.completeSwipeTimeout = null;
		}
		e.xDirection = this.swipeDirection;
		if(e.index === undefined) {
			e.index = this.swipeIndex;
		}
		this.setSwipeDirection(null);
		this.resetSwipeableTransitionTime();
		// if this wasn't a persistent item, hide it upon completion and send swipe complete event
		if(!this.getPersistSwipeableItem()) {
			this.$.swipeableComponents.setShowing(false);
			// if the swipe was completed, update the current row and bubble swipeComplete event
			if(this.swipeComplete) {
				this.doSwipeComplete(e);
			}
		} else {
			this.persistentItemVisisble = true;
		}
	},
	updateCurrentRow: function() {
		// prepare row
		this.prepareRow(this.swipeIndex);
		// update row
		this.renderRow(this.swipeIndex);
		// lock it up
		this.lockRow(this.swipeIndex);
	}
});




