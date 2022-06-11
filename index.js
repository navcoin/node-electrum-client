'use strict';

const Client = require('./lib/client');

class ElectrumClient extends Client {
  constructor(net, tls, port, host, protocol, options) {
    super(net, tls, port, host, protocol, options);
    this.timeLastCall = 0;
  }

  initElectrum(electrumConfig, persistencePolicy = { maxRetry: 1000, callback: null }) {
    this.persistencePolicy = persistencePolicy;
    this.electrumConfig = electrumConfig;
    this.timeLastCall = 0;
    return this.connect().then(() => this.server_version(this.electrumConfig.client, this.electrumConfig.version));
  }

  // Override parent
  request(method, params) {
    this.timeLastCall = new Date().getTime();
    const parentPromise = super.request(method, params);
    return parentPromise.then(response => {
      this.keepAlive();
      return response;
    });
  }

  requestBatch(method, params, secondParam) {
    this.timeLastCall = new Date().getTime();
    const parentPromise = super.requestBatch(method, params, secondParam);
    return parentPromise.then(response => {
      this.keepAlive();
      return response;
    });
  }

  onClose() {
    super.onClose();
    const list = [
      'blockchain.headers.subscribe',
      'blockchain.scripthash.subscribe',
    ];
    list.forEach(event => this.subscribe.removeAllListeners(event));
    setTimeout(() => {
      if (this.persistencePolicy != null && this.persistencePolicy.maxRetry > 0) {
        this.reconnect();
        this.persistencePolicy.maxRetry -= 1;
      } else if (this.persistencePolicy != null && this.persistencePolicy.callback != null) {
        this.persistencePolicy.callback();
      } else if (this.persistencePolicy == null) {
        this.reconnect();
      }
    }, 1000);
  }

  // ElectrumX persistancy
  keepAlive() {
    if (this.timeout != null) {
      clearTimeout(this.timeout);
    }
    this.timeout = setTimeout(() => {
      if (this.timeLastCall !== 0 && new Date().getTime() > this.timeLastCall + 5000) {
        const pingTimer = setTimeout(() => {
          this.onError(new Error('keepalive ping timeout'));
        }, 9000);
        this.server_ping().catch((reason) => {
          console.log('keepalive ping failed because of', reason);
          clearTimeout(pingTimer);
        }).then(() => clearTimeout(pingTimer));
      }
    }, 5000);
  }

  close() {
    super.close();
    if (this.timeout != null) {
      clearTimeout(this.timeout);
    }
    this.reconnect = this.reconnect = this.onClose = this.keepAlive = () => {}; // dirty hack to make it stop reconnecting
  }

  reconnect() {
    console.log('electrum reconnect');
    this.initSocket();
    return this.initElectrum(this.electrumConfig);
  }

  // ElectrumX API
  server_version(client_name, protocol_version) {
    return this.request('server.version', [client_name, protocol_version])
  }
  server_banner() {
    return this.request('server.banner', [])
  }
  server_ping() {
    return this.request('server.ping', [])
  }
  server_addPeer(features) {
    return this.request('server.add_peer', [features])
  }
  server_donation_address() {
    return this.request('server.donation_address', [])
  }
  server_features() {
    return this.request('server.features', [])
  }
  server_peers_subscribe() {
    return this.request('server.peers.subscribe', [])
  }
  blockchain_address_getProof(address) {
    return this.request('blockchain.address.get_proof', [address])
  }
  blockchain_dotnav_resolveName(name, subdomains) {
    return this.request('blockchain.dotnav.resolve_name', [name, subdomains])
  }
  blockchain_scripthash_getBalance(scripthash) {
    return this.request('blockchain.scripthash.get_balance', [scripthash])
  }
  blockchain_scripthash_getHistory(scripthash, height = 0, to_height = -1) {
    if (this.protocolVersion == '1.5') {
      return this.request('blockchain.scripthash.get_history', [scripthash, height, to_height])
    } else {
      return this.request('blockchain.scripthash.get_history', [scripthash])
    }
  }
  blockchain_scripthash_getMempool(scripthash) {
    return this.request('blockchain.scripthash.get_mempool', [scripthash])
  }
  blockchain_scripthash_listunspent(scripthash) {
    return this.request('blockchain.scripthash.listunspent', [scripthash])
  }
  blockchain_scripthash_subscribe(scripthash) {
    return this.request('blockchain.scripthash.subscribe', [scripthash])
  }
  blockchain_outpoint_subscribe(hash, out) {
    return this.request('blockchain.outpoint.subscribe', [hash, out])
  }
  blockchain_stakervote_subscribe(scripthash) {
    return this.request('blockchain.stakervote.subscribe', [scripthash])
  }
  blockchain_consensus_subscribe() {
    return this.request('blockchain.consensus.subscribe', [])
  }
  blockchain_dao_subscribe() {
    return this.request('blockchain.dao.subscribe', [])
  }
  blockchain_scripthash_unsubscribe(scripthash) {
    return this.request('blockchain.scripthash.unsubscribe', [scripthash])
  }
  blockchain_outpoint_unsubscribe(hash, out) {
    return this.request('blockchain.outpoint.unsubscribe', [hash, out])
  }
  blockchain_block_header(height, cpHeight = 0) {
    return this.request('blockchain.block.header', [height, cpHeight])
  }
  blockchain_block_headers(startHeight, count, cpHeight = 0) {
    return this.request('blockchain.block.headers', [startHeight, count, cpHeight])
  }
  blockchainEstimatefee(number) {
    return this.request('blockchain.estimatefee', [number])
  }
  blockchain_headers_subscribe() {
    return this.request('blockchain.headers.subscribe', [])
  }
  blockchain_relayfee() {
    return this.request('blockchain.relayfee', [])
  }
  blockchain_transaction_broadcast(rawtx) {
    return this.request('blockchain.transaction.broadcast', [rawtx])
  }
  blockchain_transaction_get(tx_hash, verbose) {
    return this.request('blockchain.transaction.get', [tx_hash, verbose ? verbose : false])
  }
  blockchain_transaction_getKeys(tx_hash) {
    return this.request('blockchain.transaction.get_keys', [tx_hash])
  }
  blockchain_staking_getKeys(spending_pkh) {
    return this.request('blockchain.staking.get_keys', [spending_pkh])
  }
  blockchain_token_getToken(id) {
    return this.request('blockchain.token.get_token', [id])
  }
  blockchain_token_getNft(id, subid, get_utxo) {
    return this.request('blockchain.token.get_nft', [id, subid, get_utxo ? get_utxo : false])
  }
  blockchain_transaction_getMerkle(tx_hash, height) {
    return this.request('blockchain.transaction.get_merkle', [tx_hash, height])
  }
  mempool_getFeeHistogram() {
    return this.request('mempool.get_fee_histogram', [])
  }
  
  blockchain_scripthash_getBalanceBatch(scripthash) {
    return this.requestBatch('blockchain.scripthash.get_balance', scripthash);
  }
  blockchain_scripthash_listunspentBatch(scripthash) {
    return this.requestBatch('blockchain.scripthash.listunspent', scripthash);
  }
  blockchain_scripthash_getHistoryBatch(scripthash) {
    return this.requestBatch('blockchain.scripthash.get_history', scripthash);
  }
  blockchain_transaction_getBatch(tx_hash, verbose) {
    return this.requestBatch('blockchain.transaction.get', tx_hash, verbose);
  }
  blockchain_transaction_getMerkle(tx_hash, height) {
    return this.request('blockchain.transaction.get_merkle', [tx_hash, height]);
  }
}

module.exports = ElectrumClient;
