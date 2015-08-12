
var dataCache = {};

var ModelBaseDataObject = {
	ID: '',
	isShell: false,
	cn: 'com.percero.agents.sync.mo.BaseDataObject',
	fetchingSelf: false,
	validate : function () {
		return true;
	},
	fetchSelf : function() {
		// TODO:
	},
	addToAll : function() {
		if (!dataCache[this.cn]) {
			dataCache[this.cn] = {};
		}
		if (!dataCache[this.cn][this.ID]) {
			dataCache[this.cn][this.ID] = this;
		}
		return this;
	},
	removeFromAll : function() {
		if (dataCache[this.cn]) {
			if (dataCache[this.cn][this.ID]) {
				delete dataCache[this.cn][this.ID];
			}
		}
		return this;
	},
	retrieve : function (resultCallback, faultCallback, token) {
		// TODO:
		var success = false;
		var result = this;
		var fault = "Some fault...";
		if (success) {
			resultCallback(result, token);
		} else {
			faultCallback(fault, token);
		}
		return this;
	},
	save : function (resultCallback, faultCallback, token) {
		// TODO:
		var success = false;
		var result = this;
		var fault = "Some fault...";
		if (success) {
			resultCallback(result, token);
		} else {
			faultCallback(fault, token);
		}
		return this;
	},
	remove : function (resultCallback, faultCallback, token) {
		// TODO:
		var success = false;
		var result = this;
		var fault = "Some fault...";
		if (success) {
			resultCallback(result, token);
		} else {
			faultCallback(fault, token);
		}
		return this;
	},
	toString : function () {
		if (this.isShell) {
			return "Loading...";
		} else {
			return this.ID;
		}
	}
};

var ModelCropType = Object.create(ModelBaseDataObject);
ModelCropType.cn = 'com.psiglobal.mo.CropType';
ModelCropType.nameIsSet = false;
ModelCropType.name = '';
ModelCropType.get_name = function() {
	if (!this.nameIsSet) {
		this.fetchSelf();
		return false;
	} else {
		return this.name;
	}
};
ModelCropType.set_name = function(value) {
	this.name = value;
	this.nameIsSet = true;
	return this;
};
ModelCropType.varietiesIsSet = false;
ModelCropType.varieties = [];
ModelCropType.get_varieties = function() {
	if (!this.varietiesIsSet) {
		this.fetchSelf();
		return false;
	} else {
		return this.varieties;
	}
};
ModelCropType.set_varieties = function(value) {
	this.varieties = value;
	this.varietiesIsSet = true;
	return this;
};
