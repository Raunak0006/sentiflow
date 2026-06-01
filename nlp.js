// NLP Sentiment Analysis - Advanced Client-Side Engine
// Implements custom tokenizers, VADER-inspired rule-based sentiment reasoning, and metrics extraction.

(function () {
  const NEGATIONS = new Set([
    "not", "no", "never", "none", "neither", "nor", "cannot", "cant", "dont",
    "wont", "isnt", "wasnt", "shouldnt", "couldnt", "wouldnt", "aint",
    "havent", "hadnt", "doesnt", "rarely", "seldom", "hardly", "scarcely",
    "barely", "lack", "lacks", "lacked", "without", "dont", "cant", "wont",
    "isnt", "wasnt", "didnt", "doesnt", "havent", "hadnt", "arent", "shouldnt"
  ]);

  const INTENSIFIERS = {
    // Boosters (increase intensity)
    "very": 0.3,
    "extremely": 0.5,
    "incredibly": 0.45,
    "highly": 0.4,
    "deeply": 0.35,
    "really": 0.25,
    "so": 0.25,
    "too": 0.15,
    "quite": 0.1,
    "especially": 0.3,
    "super": 0.3,
    "fully": 0.25,
    "completely": 0.3,
    "absolutely": 0.4,
    "awfully": 0.25,
    "dreadfully": 0.25,
    "hugely": 0.3,
    "tremendously": 0.4,
    "definitely": 0.2,
    "particularly": 0.25,

    // Dampeners (decrease intensity)
    "slightly": -0.15,
    "somewhat": -0.12,
    "barely": -0.2,
    "hardly": -0.2,
    "mildly": -0.1,
    "partially": -0.15,
    "scarcely": -0.15,
    "bit": -0.1,
    "little": -0.1
  };

  const STOPWORDS = new Set([
    "the", "a", "an", "and", "or", "but", "if", "then", "else", "of", "to", "for",
    "in", "on", "at", "by", "with", "from", "up", "down", "about", "into", "over",
    "after", "is", "was", "were", "are", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "i", "you", "he", "she", "it", "we", "they", "me", "him",
    "her", "us", "them", "my", "your", "his", "their", "our", "this", "that", "these",
    "those", "which", "who", "whom", "what", "where", "when", "why", "how", "as",
    "than", "so", "very", "can", "will", "just", "more", "also", "any", "some", "only",
    "other", "here", "there", "its", "it's", "am", "are", "about", "again", "further",
    "then", "once", "here", "there", "when", "where", "why", "how", "all", "any", "both",
    "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only",
    "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "don",
    "should", "now"
  ]);

  // Clean a word from surrounding punctuation, but preserve emojis and internal contractions
  function cleanToken(token) {
    if (!token) return "";
    // If it's a known emoji, keep it exactly
    if (window.SENTIMENT_LEXICON && window.SENTIMENT_LEXICON[token]) {
      return token;
    }
    // Remove leading and trailing punctuation, keeping apostrophes or letters
    return token.replace(/^[^a-zA-Z0-9😊😀😁😂🤣😃😄😅😆😉🥰😍🤩😘😗😋😛😜🤪😝🤗😏😎🥳👍👌👏🙌❤️💖✨⭐🔥💯🎉😐😑😶🙄🤨🤔🤷😒😓😔😕😟😠😡🤬😢😭😩😫😤😰😱🛑👎❌💔💩⚠️🚨🤮🤢]+|[^a-zA-Z0-9😊😀😁😂🤣😃😄😅😆😉🥰😍🤩😘😗😋😛😜🤪😝🤗😏😎🥳👍👌👏🙌❤️💖✨⭐🔥💯🎉😐😑😶🙄🤨🤔🤷😒😓😔😕😟😠😡🤬😢😭😩😫😤😰😱🛑👎❌💔💩⚠️🚨🤮🤢]+$/g, "");
  }

  // Split text into sentences using simple regex
  function splitSentences(text) {
    if (!text) return [];
    // Matches sentences ending with ., ! or ? and trailing whitespace
    const sentences = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g);
    return sentences ? sentences.map(s => s.trim()).filter(s => s.length > 0) : [text];
  }

  // Tokenize a sentence into words
  function tokenize(sentence) {
    if (!sentence) return [];
    // Match words, including emojis and words with contractions (like don't)
    const rawTokens = sentence.split(/\s+/);
    return rawTokens.map(cleanToken).filter(t => t.length > 0);
  }

  // Check if a word is entirely in ALL CAPS
  function isAllCaps(word) {
    return /^[A-Z]+$/.test(word.replace(/[^A-Za-z]/g, "")) && word.length > 1;
  }

  // VADER-style Sentiment Analyzer class
  class SentimentAnalyzer {
    constructor(customLexicon = null) {
      this.lexicon = customLexicon || window.SENTIMENT_LEXICON || {};
    }

    // Update the lexicon reference (if user edits it in settings)
    setLexicon(newLexicon) {
      this.lexicon = newLexicon;
    }

    // Analyze a single sentence
    analyzeSentence(sentence) {
      const tokens = tokenize(sentence);
      const scores = [];
      const wordBreakdown = [];
      
      const containsBut = sentence.toLowerCase().includes(" but ") || sentence.toLowerCase().includes(" however ");
      const butIndex = tokens.findIndex(t => t.toLowerCase() === "but" || t.toLowerCase() === "however");

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const tokenLower = token.toLowerCase();
        
        let score = 0;
        let isSentimentWord = false;
        let originalScore = 0;
        let negationApplied = false;
        let intensifierApplied = false;
        let capsApplied = false;

        // Check if token exists in our lexicon
        if (this.lexicon.hasOwnProperty(tokenLower) || this.lexicon.hasOwnProperty(token)) {
          isSentimentWord = true;
          const baseScore = this.lexicon[tokenLower] || this.lexicon[token];
          score = baseScore;
          originalScore = baseScore;

          // 1. Capitalization bonus (VADER rule)
          // If this word is ALL CAPS, and the overall sentence has mixed capitalization, boost score
          if (isAllCaps(token) && sentence !== sentence.toUpperCase()) {
            const capBoost = 0.733;
            if (score > 0) score += capBoost;
            else score -= capBoost;
            capsApplied = true;
          }

          // 2. Lookback window of 3 words for negations & intensifiers
          let modifierSum = 0;
          for (let lookback = 1; lookback <= 3; lookback++) {
            const prevIdx = i - lookback;
            if (prevIdx >= 0) {
              const prevToken = tokens[prevIdx].toLowerCase();

              // Check for intensifier
              if (INTENSIFIERS.hasOwnProperty(prevToken)) {
                let modifier = INTENSIFIERS[prevToken];
                // If sentiment is negative, modifier flips direction
                if (score < 0) {
                  modifierValue = modifier * -1;
                }
                
                // Boost valence
                if (score > 0) {
                  score += modifier;
                } else {
                  score -= modifier;
                }
                intensifierApplied = true;
              }

              // Check for negation
              if (NEGATIONS.has(prevToken)) {
                // If a negation is found, invert the sentiment and scale down slightly
                score = score * -0.74;
                negationApplied = true;
                break; // Stop looking further back if negated
              }
            }
          }

          // 3. Contrastive Conjunction adjustment (but / however)
          // Sentiment words before "but" are dampened, words after are amplified
          if (containsBut && butIndex !== -1) {
            if (i < butIndex) {
              score = score * 0.5; // Dampen prior clauses
            } else if (i > butIndex) {
              score = score * 1.5; // Accentuate subsequent clauses
            }
          }
        }

        if (isSentimentWord && score !== 0) {
          scores.push(score);
          wordBreakdown.push({
            word: token,
            score: parseFloat(score.toFixed(3)),
            originalScore: originalScore,
            negation: negationApplied,
            intensifier: intensifierApplied,
            caps: capsApplied
          });
        }
      }

      // 4. Punctuation intensity amplification
      let punctuationBoost = 0;
      const exclamations = (sentence.match(/!/g) || []).length;
      const questions = (sentence.match(/\?/g) || []).length;

      // Exclamation marks add a maximum of 0.291 per point up to 4
      if (exclamations > 0) {
        punctuationBoost += Math.min(exclamations * 0.15, 0.6);
      }
      
      // Question marks add a tiny uncertainty shift or intensity change
      if (questions > 1) {
        punctuationBoost -= 0.1; // Sarcasm or disbelief indicator
      }

      let sum = scores.reduce((a, b) => a + b, 0);

      // Apply punctuation boost to the final sum direction
      if (sum > 0) {
        sum += punctuationBoost;
      } else if (sum < 0) {
        sum -= punctuationBoost;
      }

      return {
        sentence: sentence,
        tokens: tokens,
        score: parseFloat(sum.toFixed(3)),
        wordBreakdown: wordBreakdown
      };
    }

    // Full document analyzer (aggregating all sentences)
    analyze(text) {
      if (!text || text.trim() === "") {
        return {
          sentiment: "neutral",
          score: 0,
          sentences: [],
          metrics: {
            wordCount: 0,
            charCount: 0,
            sentenceCount: 0,
            readingTime: 0,
            avgSentenceLength: 0
          },
          keywords: []
        };
      }

      const rawSentences = splitSentences(text);
      const sentenceResults = rawSentences.map(s => this.analyzeSentence(s));

      // Calculate compound score using VADER-style mathematical normalization:
      // compound = sum / sqrt(sum^2 + alpha)
      // where alpha = 15 is standard normalization constant
      let totalSum = sentenceResults.reduce((acc, curr) => acc + curr.score, 0);
      const alpha = 15;
      let compound = totalSum / Math.sqrt((totalSum * totalSum) + alpha);
      
      // Hard clamp compound between -1.0 and +1.0
      compound = Math.max(-1.0, Math.min(1.0, compound));
      
      // Determine overall classification category
      let sentiment = "neutral";
      if (compound >= 0.05) {
        sentiment = "positive";
      } else if (compound <= -0.05) {
        sentiment = "negative";
      }

      // Collect general text metrics
      const charCount = text.length;
      const wordsList = text.split(/\s+/).map(cleanToken).filter(w => w.length > 0);
      const wordCount = wordsList.length;
      const sentenceCount = sentenceResults.length;
      
      // Average adult reading speed: 200 words per minute (WPM)
      const readingTime = Math.max(1, Math.ceil((wordCount / 200) * 60)); // in seconds
      const avgSentenceLength = sentenceCount > 0 ? parseFloat((wordCount / sentenceCount).toFixed(1)) : 0;

      // Collect word occurrences for Word Cloud and Frequency charts
      const wordFrequency = {};
      wordsList.forEach(w => {
        const wLower = w.toLowerCase();
        if (wLower.length > 2 && !STOPWORDS.has(wLower) && !/^[0-9]+$/.test(wLower)) {
          wordFrequency[wLower] = (wordFrequency[wLower] || 0) + 1;
        }
      });

      // Sort and extract top keywords
      const keywords = Object.keys(wordFrequency)
        .map(key => ({ text: key, value: wordFrequency[key] }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 15);

      return {
        sentiment: sentiment, // "positive" | "neutral" | "negative"
        score: parseFloat(compound.toFixed(4)), // -1.0 to +1.0 compound score
        sentences: sentenceResults,
        metrics: {
          wordCount,
          charCount,
          sentenceCount,
          readingTime,
          avgSentenceLength
        },
        keywords: keywords
      };
    }
  }

  // Export class globally
  window.SentimentAnalyzer = SentimentAnalyzer;
})();
