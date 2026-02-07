// Use native Web Crypto API for SHA-256
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export class Block {
  constructor(index, timestamp, data, previousHash = "") {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data;
    this.previousHash = previousHash;
    this.nonce = 0;
    this.hash = "";
    this.miningTime = 0;
  }

  async calculateHash() {
    const data = this.index + this.previousHash + this.timestamp + JSON.stringify(this.data) + this.nonce;
    return await sha256(data);
  }

  async mineBlock(difficulty) {
    const startTime = Date.now();
    const target = Array(difficulty + 1).join("0");

    this.hash = await this.calculateHash();
    while (this.hash.substring(0, difficulty) !== target) {
      this.nonce++;
      this.hash = await this.calculateHash();
    }

    this.miningTime = Date.now() - startTime;
    console.log(`Block ${this.index} mined: ${this.hash} in ${this.miningTime}ms`);
    return this.miningTime;
  }
}

export class Blockchain {
  constructor() {
    this.chain = [];
    this.difficulty = 2;
    this.miningTimes = [];
  }

  async init() {
    const genesis = await this.createGenesisBlock();
    this.chain.push(genesis);
  }

  async createGenesisBlock() {
    const genesis = new Block(0, Date.now(), "Genesis Block", "0");
    await genesis.mineBlock(this.difficulty);
    return genesis;
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  async addBlock(data) {
    const newBlock = new Block(
      this.chain.length,
      Date.now(),
      data,
      this.getLatestBlock().hash,
    );

    const mineTime = await newBlock.mineBlock(this.difficulty);
    this.miningTimes.push(mineTime);
    this.chain.push(newBlock);

    return { block: newBlock, miningTime: mineTime };
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      // Check if blocks are properly linked
      if (currentBlock.previousHash !== previousBlock.hash) {
        return { valid: false, invalidBlock: i };
      }
    }
    return { valid: true, invalidBlock: -1 };
  }

  updateDifficulty(newDifficulty) {
    this.difficulty = parseInt(newDifficulty);
  }

  getAverageMiningTime() {
    if (this.miningTimes.length === 0) return 0;
    const sum = this.miningTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.miningTimes.length);
  }

  tamperBlock(index, newData) {
    if (index > 0 && index < this.chain.length) {
      console.log(`Tampering block ${index}: changing data to "${newData}"`);
      this.chain[index].data = newData;
      // Note: We intentionally do NOT recalculate the hash
      // This simulates tampering - the hash no longer matches the data
      return true;
    }
    return false;
  }

  async remineBlock(index) {
    if (index > 0 && index < this.chain.length) {
      const block = this.chain[index];
      const prevBlock = this.chain[index - 1];

      block.previousHash = prevBlock.hash;
      block.nonce = 0;
      return await block.mineBlock(this.difficulty);
    }
    return 0;
  }

  async reset() {
    this.chain = [];
    this.miningTimes = [];
    await this.init();
  }
}
