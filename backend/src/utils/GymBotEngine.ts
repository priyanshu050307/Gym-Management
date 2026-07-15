import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple tokenization and stemming helper
export const tokenizeAndStem = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // replace punctuation with space
    .split(/\s+/)
    .filter(word => word.length > 0)
    .map(word => {
      // Basic stemming rules to reduce words to base form
      if (word.endsWith('s') && !word.endsWith('ss')) word = word.slice(0, -1);
      if (word.endsWith('ing')) word = word.slice(0, -3);
      if (word.endsWith('ed')) word = word.slice(0, -2);
      if (word.endsWith('es')) word = word.slice(0, -2);
      if (word.endsWith('ment')) word = word.slice(0, -4);
      return word;
    });
};

// Simple entity and amount extraction
export const extractEntities = (text: string) => {
  const clean = text.toLowerCase();
  
  // Extract numbers / amounts (e.g. ₹500, 10k, 2800, 1.5 lakhs)
  const amountRegex = /(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(k|lakhs?|lacs?)?/gi;
  let matches;
  let extractedAmount: number | null = null;
  
  while ((matches = amountRegex.exec(clean)) !== null) {
    let val = parseFloat(matches[1]);
    const multiplier = matches[2];
    if (multiplier) {
      if (multiplier.startsWith('k')) val *= 1000;
      if (multiplier.startsWith('lakh') || multiplier.startsWith('lac')) val *= 100000;
    }
    extractedAmount = val;
  }

  // Extract membership plans mentioned
  const plans = ['starter', 'premium', 'student', 'corporate', 'pilates', 'trial'];
  let detectedPlan: string | null = null;
  for (const p of plans) {
    if (clean.includes(p)) {
      detectedPlan = p.charAt(0).toUpperCase() + p.slice(1);
      break;
    }
  }

  // Extract sections/modules mentioned
  const sections = ['schedules', 'plans', 'members', 'biometric', 'billing', 'branches', 'profile'];
  let detectedSection: string | null = null;
  for (const s of sections) {
    if (clean.includes(s)) {
      detectedSection = s;
      break;
    }
  }

  return {
    amount: extractedAmount,
    plan: detectedPlan,
    section: detectedSection,
  };
};

export interface ChatSessionContext {
  history: { sender: 'user' | 'bot'; text: string; timestamp: string }[];
  lastMentionedAmount?: number | null;
  lastMentionedPlan?: string | null;
  lastMentionedSection?: string | null;
  messageCount: number;
}

export class ChatbotEngine {
  private intents: any[] = [];
  private vocabulary: string[] = [];
  private idf: { [key: string]: number } = {};
  
  // MLP neural network weights
  private w1: number[][] = []; // hiddenSize x vocabSize
  private b1: number[] = [];   // hiddenSize
  private w2: number[][] = []; // outputSize x hiddenSize
  private b2: number[] = [];   // outputSize
  
  private tags: string[] = [];
  private isTrained = false;

  constructor() {
    this.loadIntents();
  }

  private loadIntents() {
    try {
      const filePath = path.resolve(__dirname, '../config/gym_intents.json');
      const data = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(data);
      this.intents = parsed.intents;
      this.trainEngine();
    } catch (err) {
      console.error('Failed to load chatbot intents:', err);
    }
  }

  private trainEngine() {
    console.log('[Chatbot] Starting GymBot NLP compilation...');

    // 1. Build Vocabulary & Tags
    this.tags = this.intents.map(intent => intent.tag);
    const documents: { stemmedWords: string[]; tag: string }[] = [];
    const allStemmedWords: string[] = [];

    for (const intent of this.intents) {
      for (const pattern of intent.patterns) {
        const stemmedWords = tokenizeAndStem(pattern);
        documents.push({ stemmedWords, tag: intent.tag });
        allStemmedWords.push(...stemmedWords);
      }
    }

    this.vocabulary = Array.from(new Set(allStemmedWords));
    
    // Calculate IDF
    const totalDocs = documents.length;
    for (const word of this.vocabulary) {
      const docsWithWord = documents.filter(doc => doc.stemmedWords.includes(word)).length;
      this.idf[word] = Math.log(totalDocs / (1 + docsWithWord));
    }

    // 2. Prepare Training Dataset
    const trainingInputs: number[][] = [];
    const trainingOutputs: number[][] = [];

    for (const doc of documents) {
      const vector = this.vectorize(doc.stemmedWords);
      trainingInputs.push(vector);

      const oneHot = new Array(this.tags.length).fill(0);
      const tagIndex = this.tags.indexOf(doc.tag);
      if (tagIndex !== -1) oneHot[tagIndex] = 1;
      trainingOutputs.push(oneHot);
    }

    // 3. Initialize MLP Network (Input -> Hidden (32) -> Output)
    const inputSize = this.vocabulary.length;
    const hiddenSize = 32;
    const outputSize = this.tags.length;

    // Standard Xavier/He initializations
    this.w1 = Array.from({ length: hiddenSize }, () => 
      Array.from({ length: inputSize }, () => (Math.random() - 0.5) * Math.sqrt(2.0 / inputSize))
    );
    this.b1 = new Array(hiddenSize).fill(0.01);

    this.w2 = Array.from({ length: outputSize }, () => 
      Array.from({ length: hiddenSize }, () => (Math.random() - 0.5) * Math.sqrt(2.0 / hiddenSize))
    );
    this.b2 = new Array(outputSize).fill(0.01);

    // 4. Train Neural Network (Mini Batch Gradient Descent)
    const epochs = 150;
    const lr = 0.15;

    for (let epoch = 0; epoch < epochs; epoch++) {
      for (let i = 0; i < trainingInputs.length; i++) {
        const x = trainingInputs[i];
        const y = trainingOutputs[i];

        // Forward propagation
        // Hidden Layer activation (ReLU)
        const z1 = new Array(hiddenSize).fill(0);
        const a1 = new Array(hiddenSize).fill(0);
        for (let j = 0; j < hiddenSize; j++) {
          z1[j] = this.b1[j];
          for (let k = 0; k < inputSize; k++) {
            z1[j] += x[k] * this.w1[j][k];
          }
          a1[j] = Math.max(0, z1[j]); // ReLU
        }

        // Output Layer activation (Softmax)
        const z2 = new Array(outputSize).fill(0);
        let expSum = 0;
        for (let j = 0; j < outputSize; j++) {
          z2[j] = this.b2[j];
          for (let k = 0; k < hiddenSize; k++) {
            z2[j] += a1[k] * this.w2[j][k];
          }
        }
        const maxZ = Math.max(...z2);
        const expZ = z2.map(v => {
          const val = Math.exp(v - maxZ);
          expSum += val;
          return val;
        });
        const a2 = expZ.map(v => v / expSum); // Softmax

        // Backpropagation
        // Output delta (Cross Entropy Loss + Softmax)
        const dZ2 = new Array(outputSize).fill(0);
        for (let j = 0; j < outputSize; j++) {
          dZ2[j] = a2[j] - y[j];
        }

        // Hidden layer delta
        const dZ1 = new Array(hiddenSize).fill(0);
        for (let j = 0; j < hiddenSize; j++) {
          let sum = 0;
          for (let k = 0; k < outputSize; k++) {
            sum += dZ2[k] * this.w2[k][j];
          }
          // ReLU derivative
          dZ1[j] = z1[j] > 0 ? sum : 0;
        }

        // Update parameters
        // w2 and b2
        for (let j = 0; j < outputSize; j++) {
          this.b2[j] -= lr * dZ2[j];
          for (let k = 0; k < hiddenSize; k++) {
            this.w2[j][k] -= lr * dZ2[j] * a1[k];
          }
        }
        // w1 and b1
        for (let j = 0; j < hiddenSize; j++) {
          this.b1[j] -= lr * dZ1[j];
          for (let k = 0; k < inputSize; k++) {
            this.w1[j][k] -= lr * dZ1[j] * x[k];
          }
        }
      }
    }

    this.isTrained = true;
    console.log(`[Chatbot] GymBot NLP successfully compiled. Vocabulary Size: ${this.vocabulary.length}. Classes: ${this.tags.length}.`);
  }

  // Convert tokenized words into standard TF-IDF input vector
  private vectorize(stemmedWords: string[]): number[] {
    const vector = new Array(this.vocabulary.length).fill(0);
    const docLen = stemmedWords.length;
    if (docLen === 0) return vector;

    const termCounts: { [key: string]: number } = {};
    for (const w of stemmedWords) {
      termCounts[w] = (termCounts[w] || 0) + 1;
    }

    for (let i = 0; i < this.vocabulary.length; i++) {
      const term = this.vocabulary[i];
      if (termCounts[term]) {
        const tf = termCounts[term] / docLen;
        const idf = this.idf[term] || 0;
        vector[i] = tf * idf;
      }
    }
    return vector;
  }

  // Predict intent and confidence
  private predict(vector: number[]): { tag: string; confidence: number } {
    if (!this.isTrained) return { tag: 'help', confidence: 1.0 };

    const hiddenSize = this.b1.length;
    const outputSize = this.b2.length;

    // Feedforward Hidden layer
    const a1 = new Array(hiddenSize).fill(0);
    for (let j = 0; j < hiddenSize; j++) {
      let sum = this.b1[j];
      for (let k = 0; k < vector.length; k++) {
        sum += vector[k] * this.w1[j][k];
      }
      a1[j] = Math.max(0, sum); // ReLU
    }

    // Feedforward Output layer
    const z2 = new Array(outputSize).fill(0);
    let expSum = 0;
    for (let j = 0; j < outputSize; j++) {
      z2[j] = this.b2[j];
      for (let k = 0; k < hiddenSize; k++) {
        z2[j] += a1[k] * this.w2[j][k];
      }
    }
    const maxZ = Math.max(...z2);
    const expZ = z2.map(v => {
      const val = Math.exp(v - maxZ);
      expSum += val;
      return val;
    });
    const probabilities = expZ.map(v => v / expSum);

    // Get max probability
    let maxIdx = 0;
    let maxProb = 0;
    for (let i = 0; i < probabilities.length; i++) {
      if (probabilities[i] > maxProb) {
        maxProb = probabilities[i];
        maxIdx = i;
      }
    }

    return {
      tag: this.tags[maxIdx],
      confidence: maxProb,
    };
  }

  // Custom Attention mechanism checking keyword similarities
  private calculateAttentionSimilarities(stemmedWords: string[]): { [tag: string]: number } {
    const scores: { [tag: string]: number } = {};
    
    for (const intent of this.intents) {
      let maxSim = 0;
      for (const pattern of intent.patterns) {
        const patternStemmed = tokenizeAndStem(pattern);
        
        // Count mutual intersections (Self-Attention dot-product style)
        let matches = 0;
        for (const w of stemmedWords) {
          if (patternStemmed.includes(w)) matches++;
        }
        
        const sim = matches / Math.sqrt(stemmedWords.length * patternStemmed.length || 1);
        if (sim > maxSim) maxSim = sim;
      }
      scores[intent.tag] = maxSim;
    }
    
    return scores;
  }

  // Handle incoming message query
  public handleMessage(message: string, context: ChatSessionContext, role?: string) {
    const stemmed = tokenizeAndStem(message);
    const entities = extractEntities(message);

    // Save context
    if (entities.amount !== null) context.lastMentionedAmount = entities.amount;
    if (entities.plan !== null) context.lastMentionedPlan = entities.plan;
    if (entities.section !== null) context.lastMentionedSection = entities.section;

    // Vectorize
    const inputVec = this.vectorize(stemmed);

    // 1. Predict with Neural Network
    let prediction = this.predict(inputVec);
    let method = 'Neural Network (MLP)';

    // 2. Attentional fallback rule-based match if confidence is too low
    if (prediction.confidence < 0.45) {
      const attentionScores = this.calculateAttentionSimilarities(stemmed);
      let bestTag = 'help';
      let bestScore = 0;

      for (const [tag, score] of Object.entries(attentionScores)) {
        if (score > bestScore) {
          bestScore = score;
          bestTag = tag;
        }
      }

      if (bestScore > 0.25) {
        prediction = { tag: bestTag, confidence: bestScore };
        method = 'Attention Similarities (Rule-based)';
      } else {
        prediction = { tag: 'help', confidence: 1.0 };
        method = 'Fallback Matcher';
      }
    }

    // Role-based restrictions
    let isRestricted = false;
    let restrictionMessage = '';

    if (prediction.tag === 'active_members' && role !== 'ADMIN' && role !== 'STAFF') {
      isRestricted = true;
      restrictionMessage = "I'm sorry, details regarding active members and occupied facilities are restricted to Administrator and Staff roles. If you are an Admin, please log in with your credentials to access this registry.";
    } else if (prediction.tag === 'biometric_sync' && role !== 'ADMIN' && role !== 'STAFF') {
      isRestricted = true;
      restrictionMessage = "Biometric check-in configurations and local check-in agents are administrative tools. Members or external visitors do not have access to these settings.";
    }

    // 3. Retrieve response template
    let responseText = '';
    if (isRestricted) {
      responseText = restrictionMessage;
      prediction.tag = 'restricted_access';
      prediction.confidence = 1.0;
      method = 'Role-Based Access Control (RBAC)';
    } else {
      const intent = this.intents.find(i => i.tag === prediction.tag) || this.intents[this.intents.length - 1];
      responseText = intent.responses[Math.floor(Math.random() * intent.responses.length)];
    }

    // Dynamic response augmentation
    if (!isRestricted && entities.amount !== null) {
      responseText = `I notice you mentioned ₹${entities.amount.toLocaleString()}. ` + responseText;
    } else if (!isRestricted && context.lastMentionedAmount) {
      responseText = responseText + ` *(Applying your previously mentioned budget: ₹${context.lastMentionedAmount.toLocaleString()})*`;
    }

    if (!isRestricted && entities.plan !== null) {
      responseText = `Checking availability for the **${entities.plan}** tier. ` + responseText;
    }

    const intentForSuggestions = this.intents.find(i => i.tag === (isRestricted ? 'help' : prediction.tag)) || this.intents[this.intents.length - 1];
    const suggestions = intentForSuggestions.suggestions || ["View Membership Plans", "Group Class Schedules"];

    // Return message metadata
    const botResponse = {
      sender: 'bot' as const,
      text: responseText,
      timestamp: new Date().toISOString(),
      metadata: {
        tag: prediction.tag,
        confidence: parseFloat(prediction.confidence.toFixed(3)),
        method,
        entities,
      },
      suggestions,
    };

    // Save to context history
    context.history.push({ sender: 'user', text: message, timestamp: new Date().toISOString() });
    context.history.push({ sender: 'bot', text: botResponse.text, timestamp: botResponse.timestamp });
    context.messageCount++;

    return botResponse;
  }
}
