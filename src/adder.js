'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var reactor_1 = require("./reactor");
var Adder = /** @class */ (function (_super) {
    __extends(Adder, _super);
    function Adder() {
        var _this = _super.call(this, null, "Adder") || this;
        _this.in1 = new reactor_1.InPort(_this);
        _this.in2 = new reactor_1.InPort(_this);
        _this.out = new reactor_1.OutPort(_this);
        _this._reactions = [
            [[_this.in1, _this.in2], new AddTwo(), [_this.in1, _this.in2, _this.out]]
        ];
        /** Type checking */
        var triggers = _this._reactions[0][0];
        var reaction = _this._reactions[0][1];
        var args = _this._reactions[0][2];
        return _this;
    }
    return Adder;
}(reactor_1.Reactor));
exports.Adder = Adder;
var AddTwo = /** @class */ (function () {
    function AddTwo() {
    }
    AddTwo.prototype.react = function (in1, in2, out) {
        var a = in1.get();
        var b = in2.get(); // FIXME: this looks a little clumsy
        if (a == null) {
            a = 0;
        }
        if (b == null) {
            b = 0;
        }
        out.set(a + b);
    };
    return AddTwo;
}());
//# sourceMappingURL=adder.js.map