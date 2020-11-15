var browser = browser || chrome

var GDocsClassName = {
	paragraph: 'kix-paragraphrenderer',
	wordNode: 'kix-wordhtmlgenerator-word-node'
}

class GDocsUtil {

	constructor() {

	}

	classNames = {
		paragraph: '.kix-paragraphrenderer',
		line: '.kix-lineview',
		selectionOverlay: '.kix-selection-overlay',
		wordNode: '.kix-wordhtmlgenerator-word-node',
		cursor: '.kix-cursor',
		cursorName: '.kix-cursor-name',
		cursorCaret: '.kix-cursor-caret',
	};

	cleanDocumentText(text) {
		var cleanedText = text.replace(/[\u200B\u200C]/g, '');
		var nonBreakingSpaces = String.fromCharCode(160);
		var regex = new RegExp(nonBreakingSpaces, 'g');
		cleanedText = cleanedText.replace(regex, ' ');
		return cleanedText;
	}

	getValidCharactersRegex() {
		return '\\wæøåÆØÅéáÉÁöÖ';
	}

	isWordBoundary(character) {
		return character.match('[' + this.getValidCharactersRegex() + ']') == null;
	}


	// Finds all the text and the caret position in the google docs document.
	getGoogleDocument() {
		var caret, caretRect;
		var caretIndex = 0;
		var caretLineIndex = 0;
		var caretLine = 0;
		var text = [];
		var nodes = [];
		var lineCount = 0;
		var globalIndex = 0;
		var selectedText = '';
		var exportedSelectionRect = undefined;
		var paragraphrenderers = document.querySelectorAll(this.classNames.paragraph);

		if (this.containsUserCaretDom()) {
			caret = this.getUserCaretDom();
			caretRect = caret.getBoundingClientRect();
		}

		for (var i = 0; i < paragraphrenderers.length; i++) {
			var lineviews = paragraphrenderers[i].querySelectorAll(this.classNames.line);
			for (var j = 0; j < lineviews.length; j++) {
				var lineText = '';
				var selectionOverlays = lineviews[j].querySelectorAll(this.classNames.selectionOverlay);
				var wordhtmlgeneratorWordNodes = lineviews[j].querySelectorAll(this.classNames.wordNode);
				for (var k = 0; k < wordhtmlgeneratorWordNodes.length; k++) {
					var wordhtmlgeneratorWordNodeRect = wordhtmlgeneratorWordNodes[k].getBoundingClientRect();
					if (caretRect) {
						if (this.doesRectsOverlap(wordhtmlgeneratorWordNodeRect, caretRect)) {
							var caretXStart =
								caretRect.left - wordhtmlgeneratorWordNodeRect.left;
							var localCaretIndex = this.getLocalCaretIndex(
								caretXStart,
								wordhtmlgeneratorWordNodes[k],
								lineviews[j]
							);
							caretIndex = globalIndex + localCaretIndex;
							caretLineIndex = lineText.length + localCaretIndex;
							caretLine = lineCount;
						}
					}
					var nodeText = this.cleanDocumentText(
						wordhtmlgeneratorWordNodes[k].textContent
					);
					nodes.push({
						index: globalIndex,
						line: lineCount,
						lineIndex: lineText.length,
						node: wordhtmlgeneratorWordNodes[k],
						lineElement: lineviews[j],
						text: nodeText,
					});

					for (var l = 0; l < selectionOverlays.length; l++) {
						var selectionOverlay = selectionOverlays[l];
						var selectionRect = selectionOverlay.getBoundingClientRect();

						if (selectionRect) exportedSelectionRect = selectionRect;

						if (
							this.doesRectsOverlap(
								wordhtmlgeneratorWordNodeRect,
								selectionOverlay.getBoundingClientRect()
							)
						) {
							var selectionStartIndex = this.getLocalCaretIndex(
								selectionRect.left - wordhtmlgeneratorWordNodeRect.left,
								wordhtmlgeneratorWordNodes[k],
								lineviews[j]
							);
							var selectionEndIndex = this.getLocalCaretIndex(
								selectionRect.left +
								selectionRect.width -
								wordhtmlgeneratorWordNodeRect.left,
								wordhtmlgeneratorWordNodes[k],
								lineviews[j]
							);
							selectedText += nodeText.substring(
								selectionStartIndex,
								selectionEndIndex
							);
						}
					}

					globalIndex += nodeText.length;
					lineText += nodeText;
				}
				text.push(lineText);
				lineCount++;
			}
		}
		return {
			nodes: nodes,
			text: text,
			selectedText: selectedText,
			caret: {
				index: caretIndex,
				lineIndex: caretLineIndex,
				line: caretLine,
			},
			selectionRect: exportedSelectionRect,
		};
	}

	doesRangesOverlap(x1, x2, y1, y2) {
		return x1 <= y2 && y1 <= x2;
	}

	// http://stackoverflow.com/questions/306316/determine-if-two-rectangles-overlap-each-other
	doesRectsOverlap(RectA, RectB) {
		return (
			RectA.left <= RectB.right &&
			RectA.right >= RectB.left &&
			RectA.top <= RectB.bottom &&
			RectA.bottom >= RectB.top
		);
	}

	// The kix-cursor contain a kix-cursor-name dom, which is only set when it is not the users cursor
	containsUserCaretDom() {
		var carets = document.querySelectorAll(this.classNames.cursor);
		for (var i = 0; i < carets.length; i++) {
			var nameDom = carets[i].querySelectorAll(this.classNames.cursorName);
			var name = nameDom[0].innerText;
			if (!name) return true;
		}
		return false;
	}

	// The kix-cursor contain a kix-cursor-name dom, which is only set when it is not the users cursor
	getUserCaretDom() {
		var carets = document.querySelectorAll(this.classNames.cursor);
		for (var i = 0; i < carets.length; i++) {
			var nameDom = carets[i].querySelectorAll(this.classNames.cursorName);
			var name = nameDom[0].innerText;
			if (!name) return carets[i].querySelectorAll(this.classNames.cursorCaret)[0];
		}

		throw 'Could not find the users cursor';
	}

	// Gets the caret index on the innerText of the element.
	// caretX: The x coordinate on where the element the caret is located
	// element: The element on which contains the text where in the caret position is
	// simulatedElement: Doing the calculation of the caret position, we need to create a temporary DOM, the DOM will be created as a child to the simulatedElement.
	getLocalCaretIndex(caretX, element, simulateElement) {
		//Creates a span DOM for each letter
		var text = this.cleanDocumentText(element.innerText);
		var container = document.createElement('div');
		var letterSpans = [];
		for (var i = 0; i < text.length; i++) {
			var textNode = document.createElement('span');
			textNode.innerText = text[i];
			textNode.style.cssText = element.style.cssText;
			// "pre" = if there are multiple white spaces, they will all be rendered. Default behavior is for them to be collapesed
			textNode.style.whiteSpace = 'pre';
			letterSpans.push(textNode);
			container.appendChild(textNode);
		}
		container.style.whiteSpace = "nowrap";
		simulateElement.appendChild(container);

		// The caret is usually at the edge of the letter, we find the edge we are closest to.
		var index = 0;
		var currentMinimumDistance = -1;
		var containerRect = container.getBoundingClientRect();
		for (var i = 0; i < letterSpans.length; i++) {
			var rect = letterSpans[i].getBoundingClientRect();
			var left = rect.left - containerRect.left;
			var right = left + rect.width;
			if (currentMinimumDistance == -1) {
				currentMinimumDistance = Math.abs(caretX - left);
			}
			var leftDistance = Math.abs(caretX - left);
			var rightDistance = Math.abs(caretX - right);

			if (leftDistance <= currentMinimumDistance) {
				index = i;
				currentMinimumDistance = leftDistance;
			}

			if (rightDistance <= currentMinimumDistance) {
				index = i + 1;
				currentMinimumDistance = rightDistance;
			}
		}

		//Clean up
		container.remove();
		return index;
	}

	//- - - - - - - - - - - - - - - - - - - -
	//Google Document utils
	//- - - - - - - - - - - - - - - - - - - -
	findWordAtCaret(googleDocument) {
		var line = googleDocument.text[googleDocument.caret.line];
		if (line.length == 0)
			return {
				word: '',
				startIndex: googleDocument.caret.index,
				endIndex: googleDocument.caret.index,
			};

		var startIndex = googleDocument.caret.lineIndex;
		var endIndex = googleDocument.caret.lineIndex;

		//We are at the end of the line
		if (googleDocument.caret.lineIndex >= line.length) {
			startIndex = line.length - 1;
			endIndex = line.length - 1;
		}

		//Finds the start of the word
		var character = line[startIndex];
		//If we are at the end of the word, the startIndex will result in a word boundary character.
		if (this.isWordBoundary(character) && startIndex > 0) {
			startIndex--;
			character = line[startIndex];
		}
		while (!this.isWordBoundary(character) && startIndex > 0) {
			startIndex--;
			character = line[startIndex];
		}

		//Finds the end of the word
		character = line[endIndex];
		while (!this.isWordBoundary(character) && endIndex < line.length - 1) {
			endIndex++;
			character = line[endIndex];
		}

		var globalStartIndex =
			googleDocument.caret.index - googleDocument.caret.lineIndex + startIndex;
		var globalEndIndex =
			googleDocument.caret.index - googleDocument.caret.lineIndex + endIndex;
		return {
			word: line.substring(startIndex, endIndex).trim(),
			startIndex: globalStartIndex,
			endIndex: globalEndIndex,
		};
		//return line.substring(startIndex, endIndex).trim();
	}

	//- - - - - - - - - - - - - - - - - - - -
	//Highlight
	//- - - - - - - - - - - - - - - - - - - -
	highlight(startIndex, endIndex, googleDocument) {
		for (var i = 0; i < googleDocument.nodes.length; i++) {
			//Highlight node if its index overlap with the provided index
			if (
				this.doesRangesOverlap(
					startIndex,
					endIndex,
					googleDocument.nodes[i].index,
					googleDocument.nodes[i].index + googleDocument.nodes[i].text.length
				)
			) {
				//Only draw highlight if there is text to highlight
				var textToHighlight = this.getTextInNode(
					startIndex,
					endIndex,
					googleDocument.nodes[i]
				);
				if (!textToHighlight.trim()) continue;

				var parentRect = googleDocument.nodes[i].lineElement.getBoundingClientRect();
				var nodeRect = googleDocument.nodes[i].node.getBoundingClientRect();
				var leftPosOffset = 0;
				var rightPosOffset = nodeRect.width;
				if (startIndex > googleDocument.nodes[i].index) {
					var localIndex = startIndex - googleDocument.nodes[i].index;
					leftPosOffset = this.getPositionOfIndex(
						localIndex,
						googleDocument.nodes[i].node,
						googleDocument.nodes[i].lineElement
					);
				}

				if (
					endIndex <
					googleDocument.nodes[i].index + googleDocument.nodes[i].text.length
				) {
					rightPosOffset = this.getPositionOfIndex(
						endIndex - googleDocument.nodes[i].index,
						googleDocument.nodes[i].node,
						googleDocument.nodes[i].lineElement
					);
				}
				this.createHighlightNode(
					nodeRect.left - parentRect.left + leftPosOffset,
					nodeRect.top - parentRect.top,
					rightPosOffset - leftPosOffset,
					nodeRect.height,
					googleDocument.nodes[i].lineElement
				);
			}
		}
	}

	getText(startIndex, endIndex, googleDocument) {
		var text = '';
		for (var i = 0; i < googleDocument.nodes.length; i++) {
			if (
				this.doesRangesOverlap(
					startIndex,
					endIndex,
					googleDocument.nodes[i].index,
					googleDocument.nodes[i].index + googleDocument.nodes[i].text.length
				)
			) {
				var textInNode = this.getTextInNode(
					startIndex,
					endIndex,
					googleDocument.nodes[i]
				);
				text += textInNode;
			}
		}

		return text;
	}

	getTextInNode(startIndex, endIndex, node) {
		var start = 0;
		var end = node.text.length;
		if (startIndex > node.index) {
			start = startIndex - node.index;
		}
		if (endIndex < node.index + node.text.length) {
			end = endIndex - node.index;
		}
		return node.text.substring(start, end);
	}

	createHighlightNode(left, top, width, height, parentElement) {
		var highlightNode = document.createElement('div');
		highlightNode.setAttribute('class', 'dictus_highlight_node');
		highlightNode.style.position = 'absolute';
		highlightNode.style.left = left + 'px';
		highlightNode.style.top = top + 'px';
		highlightNode.style.width = width + 'px';
		highlightNode.style.height = height + 'px';
		highlightNode.style.backgroundColor = '#D1E3FF';
		highlightNode.style.color = '#D1E3FF';
		highlightNode.style.borderBottomColor = '#FFFF00';
		//Fuzzy edges on the highlight
		highlightNode.style.boxShadow = '0px 0px 1px 1px #D1E3FF';

		parentElement.appendChild(highlightNode);
	}

	removeHighlightNodes() {
		var highlightNodes = document.querySelectorAll(
			'.dictus_highlight_node'
		);
		for (i = 0; i < highlightNodes.length; i++) {
			highlightNodes[i].remove();
		}
	}

	//Index: The index on the local element
	getPositionOfIndex(index, element, simulateElement) {
		//If index is 0 it is always the left most position of the element
		if (index == 0) {
			return 0;
		}

		//Creates a span DOM for each letter
		var text = this.cleanDocumentText(element.innerText);
		var container = document.createElement('div');
		var letterSpans = [];
		for (var i = 0; i < index; i++) {
			var textNode = document.createElement('span');
			textNode.innerText = text[i];
			textNode.style.cssText = element.style.cssText;
			//"pre" = if there are multiple white spaces, they will all be rendered. Default behavior is for them to be collapesed
			textNode.style.whiteSpace = 'pre';
			letterSpans.push(textNode);
			container.appendChild(textNode);
		}
		simulateElement.appendChild(container);

		var containerRect = container.getBoundingClientRect();
		var rect = letterSpans[index - 1].getBoundingClientRect();
		var leftPosition = rect.left + rect.width - containerRect.left;

		//Clean up
		container.remove();
		return leftPosition;
	}





}


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
			// console.log('=== getValidInput in ', allInputs[i])
			results.push(allInputs[i]);
		}
	}
	console.log("getValidInput ", JSON.stringify(results));
	return results;
}

function getValidInputForGDocs() {
	var gDocs = new GDocsUtil();
	var docs = gDocs.getGoogleDocument();
	// console.log('hihi ', gDocs.getGoogleDocument());

	gDocs.highlight(10, 20, docs);

	console.log('find ', gDocs.findWordAtCaret(docs));
	// var allParagraph = document.getElementsByClassName(GDocsClassName.paragraph);
	// var results = [];
	// for (var i in allParagraph) {
	// 	if (allParagraph[i].outerText.length > 0) {
	// 		results.push(allParagraph[i]);
	// 	}
	// }
	// console.log("== getValidInputForGDocs: ", JSON.stringify(results));
	// return results;
}

function appendNodeCorrect(target, newMsg, rawMsg) {
	// var node = document.createElement("node-correct");
	// target.parentNode.appendChild(node);
	// // console.log
	// var textnode = document.createTextNode(msg);
	// // textnode.style.borderBottom="3px red dashed;";
	// node.appendChild(textnode);
	// target.parentNode.appendChild(node);
	// target.style.borderBottom = "3px dashed #0000FF";
	// console.log('=== appendNodeCorrect ', textnode);

	var outSplited = newMsg.split(' ');
	var rawSplited = rawMsg.split(' ');
	for (var i = 0; i < rawSplited.length; i++) {
		if (outSplited[i] && outSplited[i].length > 0 && outSplited[i] != rawSplited[i]) {
			// rawSplited[i] = "<strong>" + rawSplited[i] + "</strong>";
			rawMsg = rawMsg.replace(rawSplited[i], "<strong>" + rawSplited[i] + "</strong>")
		}

		// con
		sole.log('== ', i, " ", rawSplited[i], " - ", outSplited[i]);
	}
	// target.html(rawMsg);
}

function init() {
	
	var allInputs = getInputsByValue();
	getValidInputForGDocs();
	if (allInputs.length == 0) {
		console.log('=== found 0 input');
	} else {
		var validInput = getValidInput(allInputs);
		validInput.forEach(function (el) {
			el.addEventListener('input', (e) => {
				console.log('in: ', el, " | ", el.value)
				if (el.value.length > 10) {
					if (!el.isSetTimeout) {
						console.log('== voday');
						el.isSetTimeout = true;
						el.timeout = setTimeout(function () {
							browser.runtime.sendMessage({
								message: el.value
							}, function (response) {
								console.log("response: ", response);
								appendNodeCorrect(el, response.message, el.value)
								el.isSetTimeout = false;
							});
						}, 1000)
					}
				}
			})
		})
	}
}

function test(){
	var g = new GDocsUtil();
	console.log('== tét ', g.getUserCaretDom());
}



document.onreadystatechange = function () {
	if (document.readyState == "complete") {
		setTimeout(function () {
			init();
		}, 500);

		// setInterval(function(){
		// 	test();
		// }, 1000);

	}
}
