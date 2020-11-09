import 'babel-polyfill';
const tf = require('@tensorflow/tfjs');
const MODEL_PATH = "http://vps.ziinhh.site:8000/model.json";

const MAXLEN = 30
const NGRAM = 5
var alphabet = ['\x00', ' ', '_', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k',
	'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D',
	'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W',
	'X', 'Y', 'Z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'á', 'à', 'ả', 'ã', 'ạ', 'â', 'ấ',
	'ầ', 'ẩ', 'ẫ', 'ậ', 'ă', 'ắ', 'ằ', 'ẳ', 'ẵ', 'ặ', 'ó', 'ò', 'ỏ', 'õ', 'ọ', 'ô', 'ố', 'ồ', 'ổ', 'ỗ',
	'ộ', 'ơ', 'ớ', 'ờ', 'ở', 'ỡ', 'ợ', 'é', 'è', 'ẻ', 'ẽ', 'ẹ', 'ê', 'ế', 'ề', 'ể', 'ễ', 'ệ', 'ú', 'ù', 'ủ',
	'ũ', 'ụ', 'ư', 'ứ', 'ừ', 'ử', 'ữ', 'ự', 'í', 'ì', 'ỉ', 'ĩ', 'ị', 'ý', 'ỳ', 'ỷ', 'ỹ', 'ỵ', 'đ', 'Á', 'À',
	'Ả', 'Ã', 'Ạ', 'Â', 'Ấ', 'Ầ', 'Ẩ', 'Ẫ', 'Ậ', 'Ă', 'Ắ', 'Ằ', 'Ẳ', 'Ẵ', 'Ặ', 'Ó', 'Ò', 'Ỏ', 'Õ', 'Ọ', 'Ô', 'Ố',
	'Ồ', 'Ổ', 'Ỗ', 'Ộ', 'Ơ', 'Ớ', 'Ờ', 'Ở', 'Ỡ', 'Ợ', 'É', 'È', 'Ẻ', 'Ẽ', 'Ẹ', 'Ê', 'Ế', 'Ề', 'Ể', 'Ễ', 'Ệ', 'Ú',
	'Ù', 'Ủ', 'Ũ', 'Ụ', 'Ư', 'Ứ', 'Ừ', 'Ử', 'Ữ', 'Ự', 'Í', 'Ì', 'Ỉ', 'Ĩ', 'Ị', 'Ý', 'Ỳ', 'Ỷ', 'Ỹ', 'Ỵ', 'Đ'
]
var browser = browser || chrome
const input_shape = alphabet.length;
class BackgroundProcessing {
	constructor() {
		this.loadModel();
		this.addListener();
	}

	trim(s) {
		return (s || '').replace(/^\s+|\s+$/g, '');
	}

	extract_phrases(text) {
		var out = " ";
		text = text.split(' ');
		const reg = /\W|_/g;
		for (var x in text) {
			text[x] = text[x].replace(reg, '');
			out += text[x];
			out += " ";
		}
		return out.trim();
	}

	encode(text, maxlen = MAXLEN) {
		text = "\x00" + text;
		var x = tf.buffer([maxlen, input_shape]);
		var i = 0;

		for (i in text) {
			x.set(1, i, alphabet.indexOf(text[i]))
		}
		var len = text.length;
		if (len < maxlen) {
			for (var j = len; j < maxlen; j++) {
				x.set(1, j, 0)
			}
		}
		return x;
	}

	decode(ts) {
		const logits = ts.reshape([MAXLEN, input_shape]);
		const arrBuffer = logits.argMax(-1).dataSync();
		var out = '';
		for (var i in arrBuffer) {
			out += alphabet[arrBuffer[i]];
		}
		return out.trim();
	}

	gen_ngrams(sentence, n = 3) {
		var out = [];
		var list_word = sentence.split(" ");
		var index = list_word.length - n + 1;
		var start = 0;
		while (start < index) {
			var item = list_word.slice(start, start + n).toString().replace(/,/g, ' ');
			out.push(item);
			start++
		}
		return out;
	}

	_correct(sentence) {
		var ngrams = this.gen_ngrams(sentence, Math.min(NGRAM, sentence.split(' ').length))
		var guessed_ngrams = [];
		for (var i in ngrams) {
			guessed_ngrams.push(
				this.decode(my_model.predictOnBatch(this.encode(ngrams[i]).toTensor().reshape([1, MAXLEN, input_shape])))
			);
		}
		return guessed_ngrams;
	}

	correct_sentence(sentence) {
		var list_phrases = this.extract_phrases(sentence);
		var output = "";
		for (var p in list_phrases) {
			if (list_phrases[p].length < 2) {
				output += list_phrases[p];
			} else {
				output += this._correct(list_phrases[p]);
				if (list_phrases[p - 1] == ' ') {
					output += " ";
				}
			}
		}
		return output;
	}

	mode(array) {
		if (array.length == 0)
			return null;
		var modeMap = {};
		var maxEl = array[0],
			maxCount = 1;
		for (var i = 0; i < array.length; i++) {
			var el = array[i];
			if (modeMap[el] == null)
				modeMap[el] = 1;
			else
				modeMap[el]++;
			if (modeMap[el] > maxCount) {
				maxEl = el;
				maxCount = modeMap[el];
			}
		}
		return maxEl;
	}

	async predict(sentence) {
		console.log('==on predict: ', sentence);
		// sentence = 'Diệc dung ikipedia lhư ngũồn tham chảo đã gâi rạ tanh uận vổ tính ở ca ó làm nó cos thể bi phas hoài';
		try {
			var ngrams = this.gen_ngrams(sentence, Math.min(NGRAM, sentence.split(' ').length))
			var guessed_ngrams = [];
			for (var i in ngrams) {
				guessed_ngrams.push(
					this.decode(this.model.predictOnBatch(this.encode(ngrams[i]).toTensor().reshape([1, MAXLEN, input_shape]))).replace(/\u0000/g, "")
				);
			}
			var len = guessed_ngrams.length + Math.min(sentence.split(' ').length, NGRAM) - 1
			var listCounter = [];
			for (let i = 0; i < len; i++) {
				var counter = [];
				listCounter.push(counter)
			}
			for (let i in guessed_ngrams) {
				var guessed_ngram = guessed_ngrams[i].split(" ");
				for (let j in guessed_ngram) {
					var index = parseInt(i) + parseInt(j);
					listCounter[index] && listCounter[index].push(guessed_ngram[j])
				}
			}
			var out = "";
			for (let i in listCounter) {
				out += this.mode(listCounter[i]) + " ";
			}
			console.log('== ', out)
		} catch (e) {
			console.log("error: ", e);
		}
	};

	async loadModel() {
		console.log('Loading model...');
		this.model = await tf.loadLayersModel(MODEL_PATH);
		console.log('Loaded model', this.model);
	}

	correctSentence(sentence){
		return this.predict(sentence).then(function(res){
			return res;
		});
	}

	addListener() {
		var self = this;
		chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
			if (!self.model) {
				console.log('Model not loaded yet, delaying...');
				setTimeout(() => { self.addListener() }, 5000);
				return;
			}
			var res = self.correctSentence(request.message).then(function(result){
				return result;
			});
			console.log("background: ", request, " | ", res);
			sendResponse({
				message: res
			});

		});
	}

	

}

var bg = new BackgroundProcessing();