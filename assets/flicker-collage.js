(function () {
	// Cadence. FADE_MS must match the opacity transition in flicker-collage.css (1s).
	var TICK_MS = 1800; // time between swaps
	var FADE_MS = 1000; // opacity fade duration
	var POS_RESERVE_MS = FADE_MS + 120; // keep a vacated slot blocked until its fade-out finishes

	function range(n) {
		var a = [];
		for (var i = 0; i < n; i++) a.push(i);
		return a;
	}

	function shuffle(a) {
		for (var i = a.length - 1; i > 0; i--) {
			var j = Math.floor(Math.random() * (i + 1));
			var t = a[i];
			a[i] = a[j];
			a[j] = t;
		}
		return a;
	}

	// Scatter positions per breakpoint, as grid-area strings. All kept inside the
	// 22-column x 10-row grid defined in flicker-collage.css.
	function getPositions() {
		var w = window.innerWidth;
		if (w < 768) {
			return ["1/2/3/10", "1/13/3/22", "8/2/10/10", "8/13/10/22", "4/2/6/8", "4/15/7/22"];
		} else if (w < 1150) {
			return ["2/2/5/6", "1/8/3/13", "4/16/6/20", "7/5/9/9", "2/10/4/13", "9/2/11/7"];
		}
		return ["2/2/6/5", "1/9/3/11", "6/17/9/20", "9/5/11/10", "2/19/5/22", "7/2/10/6"];
	}

	function setup(box) {
		var items = [].slice.call(box.querySelectorAll(".flicker-collage_item"));
		var n = items.length;
		if (n === 0) return;
		if (n === 1) {
			items[0].classList.add("visible");
			return;
		}

		var positions = getPositions();
		var timer = null;
		var resizeTimer = null;
		var gen = 0; // invalidates pending timeouts after a restart

		// Per-item state
		var status = new Array(n); // "hidden" | "in" | "out"
		var posOf = new Array(n); // index into positions, or -1
		var order = []; // item indices currently "in", oldest first
		var itemRR = []; // round-robin item order
		var irr = 0;
		var posLastUsed = []; // tick index a position was last taken (for LRU cycling)
		var tickCount = 0;

		function usedPositions() {
			var used = {};
			for (var i = 0; i < n; i++) {
				if (status[i] !== "hidden" && posOf[i] >= 0) used[posOf[i]] = true;
			}
			return used;
		}

		// Pick a free position, preferring the least-recently-used so tiles cycle
		// through every spot instead of clustering.
		function pickPosition() {
			var used = usedPositions();
			var best = -1;
			var bestSeen = Infinity;
			for (var p = 0; p < positions.length; p++) {
				if (used[p]) continue;
				var seen = posLastUsed[p] === undefined ? -1 : posLastUsed[p];
				if (seen < bestSeen) {
					bestSeen = seen;
					best = p;
				}
			}
			return best;
		}

		function pickItem() {
			for (var k = 0; k < n; k++) {
				var idx = itemRR[irr % n];
				irr++;
				if (status[idx] === "hidden") return idx;
			}
			return -1;
		}

		function enter() {
			var idx = pickItem();
			var pos = pickPosition();
			if (idx < 0 || pos < 0) return;
			var el = items[idx];
			// Item is hidden (opacity 0): moving it now is invisible — no teleport.
			el.style.gridArea = positions[pos];
			posOf[idx] = pos;
			status[idx] = "in";
			posLastUsed[pos] = tickCount;
			// Force reflow so the opacity transition runs from 0 -> 1.
			void el.offsetWidth;
			el.classList.add("visible");
			order.push(idx);
		}

		function exitOldest() {
			if (order.length === 0) return;
			var idx = order.shift();
			var el = items[idx];
			status[idx] = "out";
			el.classList.remove("visible"); // fades out; its slot stays reserved during the fade
			var myGen = gen;
			setTimeout(function () {
				if (myGen !== gen) return;
				if (status[idx] === "out") {
					status[idx] = "hidden";
					posOf[idx] = -1;
				}
			}, POS_RESERVE_MS);
		}

		function tick() {
			tickCount++;
			exitOldest();
			enter();
		}

		function start() {
			gen++;
			if (timer) {
				clearInterval(timer);
				timer = null;
			}
			for (var i = 0; i < n; i++) {
				items[i].classList.remove("visible");
				items[i].style.gridArea = "";
				status[i] = "hidden";
				posOf[i] = -1;
			}
			order.length = 0;
			itemRR = shuffle(range(n));
			irr = 0;
			posLastUsed = [];
			tickCount = 0;

			// Show as many at once as we can while keeping at least one spare item to rotate in.
			var base = window.innerWidth < 768 ? 2 : 3;
			var visibleCount = Math.min(base, n - 1, positions.length - 1);
			if (visibleCount < 1) visibleCount = 1;
			for (var v = 0; v < visibleCount; v++) enter();

			timer = setInterval(tick, TICK_MS);
		}

		window.addEventListener("resize", function () {
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(function () {
				positions = getPositions();
				start();
			}, 250);
		});

		start();
	}

	function initAll() {
		var boxes = document.querySelectorAll(".flicker-collage-box");
		for (var i = 0; i < boxes.length; i++) setup(boxes[i]);
	}

	document.addEventListener("DOMContentLoaded", initAll);
	document.addEventListener("shopify:section:load", initAll);
})();
