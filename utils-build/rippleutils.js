'use strict';
if (typeof window !== 'undefined') {
	class BN {
		constructor(val) {
			if (typeof val === 'string') {
				if (val.trim() === '') {
					throw new Error('invalid number');
				}
				if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(val)) {
					throw new Error('invalid number');
				}
			}
			this.val = Number(val);
			if (isNaN(this.val)) {
				throw new Error('invalid number');
			}
		}
		isNeg() {
			return this.val < 0;
		}
		isZero() {
			return this.val === 0;
		}
	}
	window['BN'] = BN;
	window['xrpl'] = require('xrpl');
	window['utils'] = require('./utils.js');
}
