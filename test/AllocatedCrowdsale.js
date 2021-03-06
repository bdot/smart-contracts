var AllocatedCrowdsale = artifacts.require('./AllocatedCrowdsale.sol');
var CentrallyIssuedToken = artifacts.require('./CentrallyIssuedToken.sol');
var FlatPricing = artifacts.require('./FlatPricing.sol');
var MultiSigWallet = artifacts.require('./MultiSigWallet.sol');
var DefaultFinalizeAgent = artifacts.require('./DefaultFinalizeAgent.sol');
const assertJump = require('./helpers/assertJump');
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
const moment = require('moment');

const TOTAL_SUPPLY = 1 * Math.pow(10, 9) * Math.pow(10, 8);
const CROWDSALE_SUPPLY = 330000000 * Math.pow(10, 8);

const start = moment().add(-1, 'days').toDate().getTime() / 1000;
const end = moment().add(30, 'days').toDate().getTime() / 1000;
const min = 33000000000000000;
const baseEthCap = 10000000000000000000;

var name = 'Anacoin';
var symbol = 'ANAT';
var totalSupply = TOTAL_SUPPLY;
var decimals = 8;

var cap = 80000000000000000000000;
var multiplier = 10 ** 8;
var ethToUsd = 300;

contract('AllocatedCrowdsale', function (accounts) {
    let crowdsale;
    let token;
    let wallet;
    let pricing;
    let finalizer;
    beforeEach(function () {
        return Promise.resolve().then(() => FlatPricing.new())
            .then(_pricing => {
                pricing = _pricing;
            }).then(() => MultiSigWallet.new([accounts[1], accounts[2]], 2))
            .then(_wallet => {
                wallet = _wallet
            }).then(() => CentrallyIssuedToken.new(accounts[0], name, symbol, totalSupply, decimals))
            .then(_token => {
                token = _token;
            }).then(() => token.setTransferAgent(accounts[0], true))
            .then(() => token.setUpgradeMaster(wallet.address))
            .then(() => AllocatedCrowdsale.new(token.address, pricing.address, wallet.address, start, end, min, accounts[0], baseEthCap, ethToUsd))
            .then(_crowdsale => {
                crowdsale = _crowdsale;
            }).then(() => DefaultFinalizeAgent.new(token.address, crowdsale.address))
            .then(_finalizer => {
                finalizer = _finalizer;
            }).then(() => crowdsale.setFinalizeAgent(finalizer.address))
            .then(() => token.setReleaseAgent(finalizer.address))
            .then(() => token.setTransferAgent(finalizer.address, true))
            .then(() => token.setTransferAgent(crowdsale.address, true))
            .then(() => token.setTransferAgent(wallet.address, true))
            .then(() => token.approve(crowdsale.address, 33000000000000000));
    });
    it('should have the crowdsale contract authorized to transfer 330 million tokens', function () {
        return token.allowance(accounts[0], crowdsale.address).then(allowance => {
            return assert.equal(allowance, CROWDSALE_SUPPLY, 'There were not 330 million tokens authorized for transfer by the crowdsale');
        });
    });
    it('should work with the whitelist', function () {
        return crowdsale.addToWhitelist(accounts[5], true).then(() => crowdsale.sendTransaction({ from: accounts[5], value: 1000000000000 })).then(() => {
            assert.equal(true, true);
        });
    });
    it('should fail if account not in whitelist', function () {
        return crowdsale.sendTransaction({ from: accounts[5], value: 1000000000000 }).then(() => {
            assert.fail('Should have failed');
        }).catch(assertJump);
    });
    it('should forward all funds to the wallet', function () {
        return crowdsale.addToWhitelist(accounts[5], true).then(() => crowdsale.sendTransaction({ from: accounts[5], value: 1000000000000 })).then(() => {
            return getBalance(wallet.address);
        }).then(balance => {
            assert.equal(balance, 1000000000000);
        })

        function getBalance(address) {
            return new Promise((resolve, reject) => {
                web3.eth.getBalance(address, (error, result) => {
                    if (error) return reject(error);
                    return resolve(result);
                });
            });
        }
    });

    it('should have price of 15000 for 1ETH when ethToUsd is 300', function() {
        return pricing
            .calculatePrice(10 ** 8, 0, 0, null, 8)
            .then(function(value) {
                return assert.equal(value, 15000, "incorrect price:" + value);
            });
    })


    it('should have price of 17500 for 1ETH when ethToUsd is 350', function() {
        return crowdsale
            .setEthToUsd(350)
            .then(function() {
                return pricing
                    .calculatePrice(10 ** 8, 0, 0, null, 8)
                    .then(function(value) {
                        return assert.equal(value, 17500, "incorrect price:" + value);
                    });
            });
    });
});