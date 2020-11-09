var browser = browser || chrome

function getInputsByValue() {
	var allInputs = document.getElementsByTagName("input");
	var results = [];
	for (var x = 0; x < allInputs.length; x++)
		results.push(allInputs[x]);

	var allTextArea = document.getElementsByTagName("textarea");
	for (var x = 0; x < allTextArea.length; x++)
		results.push(allTextArea[x]);

	return results;
}

function getValidInput(allInputs) {
	var results = [];
	for (var i in allInputs) {
		if (allInputs[i].type == 'text' || allInputs[i].type == "textarea") {
			results.push(allInputs[i]);
		}
	}
	console.log("getValidInput ", JSON.stringify(results));
	return results;
}

function init() {
	var allInputs = getInputsByValue();
	if (allInputs.length == 0) {
		console.log('=== found 0 input');
	} else {
		var validInput = getValidInput(allInputs);
		validInput.forEach(function (el) {
			el.addEventListener('input', (e) => {
				if (el.value.length > 10) {
					if (!el.isSetTimeout) {
						console.log('== voday');
						el.isSetTimeout = true;
						el.timeout = setTimeout(function () {
							chrome.runtime.sendMessage({
								message: el.value
							}, function (response) {
								console.log("response: ", response);
								el.isSetTimeout = false;
							});
						}, 10000)
					}
				}
			})
		})
	}
}

document.onreadystatechange = function () {
	if (document.readyState == "complete") {
		setTimeout(function () {
			init();
		}, 500);

	}
}