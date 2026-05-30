'use strict';
if (typeof window !== 'undefined') {
	class BN {
		constructor(val) {
			if (typeof val === 'string') {
				if (val.trim() === '') {
					throw new Error('invalid number');
				}
				if (!/^[+-]?\d+$/.test(val)) {
					throw new Error('invalid number');
				}
			}
			this.val = BigInt(val);
		}
		isNeg() {
			return this.val < 0n;
		}
		isZero() {
			return this.val === 0n;
		}
	}
	window['BN'] = BN;
	window['xrpl'] = require('xrpl');
	window['utils'] = require('./utils.js');
}
