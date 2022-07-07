const path = require('path')
const { ethers, getNamedAccounts, getChainId, deployments } = require("hardhat");
const { deploy } = deployments;
const { expect } = require('chai');

const uniswapRouterABI = require("../artifacts/contracts/libs/dexRouter.sol/IPancakeSwapRouter.json").abi;
const uniswapPairABI = require("../artifacts/contracts/libs/dexfactory.sol/IPancakeSwapPair.json").abi;

// const { deploy1820 } = require('deploy-eip-1820');
const chalk = require('chalk');
const fs = require('fs');

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay * 1000));

let owner, user1, user2, user3, user4;
let auto, treasury, safety, charity;

function dim() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.dim.call(chalk, ...arguments));
  }
}

function cyan() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.cyan.call(chalk, ...arguments));
  }
}

function yellow() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.yellow.call(chalk, ...arguments));
  }
}

function green() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.green.call(chalk, ...arguments));
  }
}

function displayResult(name, result) {
  if (!result.newlyDeployed) {
    yellow(`Re-used existing ${name} at ${result.address}`);
  } else {
    green(`${name} deployed at ${result.address}`);
  }
}

const chainName = (chainId) => {
  switch (chainId) {
    case 1:
      return 'Mainnet';
    case 3:
      return 'Ropsten';
    case 4:
      return 'Rinkeby';
    case 5:
      return 'Goerli';
    case 42:
      return 'Kovan';
    case 56:
      return 'Binance Smart Chain';
    case 77:
      return 'POA Sokol';
    case 97:
      return 'Binance Smart Chain (testnet)';
    case 99:
      return 'POA';
    case 100:
      return 'xDai';
    case 137:
      return 'Matic';
    case 1337:
        return 'HardhatEVM';
    case 31337:
      return 'HardhatEVM';
    case 80001:
      return 'Matic (Mumbai)';
    default:
      return 'Unknown';
  }
};

const displayTokenInfo = async(tokenIns) => {
  cyan("*****************************");
  cyan("     Token Information     ");
  cyan("*****************************");

  const name = await tokenIns.name();
  dim(`token name: ${name}`);
  const symbol = await tokenIns.symbol();
  dim(`token symbol: ${symbol}`);
  const decimal = await tokenIns.decimals();
  dim(`token decimal: ${decimal.toString()}`);
  const totalSupply = await tokenIns.totalSupply();
  dim(`token total supply: ${ethers.utils.formatEther(totalSupply.toString())}`);
}

const displayWalletBalances = async(tokenIns, bOwner, bUser1, bUser2) => {
  let count = 0;
  if(bOwner){
    let balance = await tokenIns.balanceOf(owner.address);
    console.log("owner balance:",
                ethers.utils.formatEther(balance.toString()));
    count++;
  }
  if(bUser1){
    let balance = await tokenIns.balanceOf(user1.address);
    console.log("user1 balance:",
                ethers.utils.formatEther(balance.toString()));
    count++;
  }
  if(bUser2){
    let balance = await tokenIns.balanceOf(user2.address);
    console.log("user2 balance:",
                ethers.utils.formatEther(balance.toString()));
    count++;
  }
  if(count > 0)
    green("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$");
};

const displayLiquidityPoolBalance = async(comment, poolInstance) => {
  let reservesPair = await poolInstance.getReserves();
  console.log(comment);
  let reserve0 = ethers.utils.formatEther(reservesPair.reserve0);
  let reserve1 = ethers.utils.formatEther(reservesPair.reserve1);
  reserve0 = (reserve0 > reserve1)? reserve0: reserve1;
  console.log("tokenA:", reserve0);
  console.log("tokenB:", reserve1);
  console.log("tokenA price: $", reserve1/reserve0);
}

const addLiquidityToPools = async(
  tokenA, tokenB,
  routerInstance, walletIns,
  smtAmount1, bnbAmount, 
  smtAmount2, busdAmount
) => {
    ///////////////////  SWL-BNB Add Liquidity /////////////////////
    let tx = await tokenA.connect(walletIns).approve(
      routerInstance.address,
      ethers.utils.parseUnits(Number(smtAmount1+100).toString(),18)
    );
    await tx.wait();

    console.log("approve tx: ", tx.hash);

    tx = await routerInstance.connect(walletIns).addLiquidityETH(
      tokenA.address,
      ethers.utils.parseUnits(Number(smtAmount1).toString(), 18),
      0,
      0,
      walletIns.address,
      "111111111111111111111",
      {value : ethers.utils.parseUnits(Number(bnbAmount).toString(), 18)}
    );
    await tx.wait();
    console.log("SWL-BNB add liquidity tx: ", tx.hash);
    ///////////////////  SWL-BUSD Add Liquidity /////////////////////

    tx = await tokenA.connect(walletIns).approve(
      routerInstance.address,
      ethers.utils.parseUnits(Number(smtAmount2+100).toString(), 18)
    );
    await tx.wait();

    tx = await tokenB.connect(walletIns).approve(
      routerInstance.address,
      ethers.utils.parseUnits(Number(busdAmount+100).toString(), 18)
    );
    await tx.wait();

    tx = await routerInstance.connect(walletIns).addLiquidity(
      tokenA.address,
      tokenB.address,
      ethers.utils.parseUnits(Number(smtAmount2).toString(), 18),
      ethers.utils.parseUnits(Number(busdAmount).toString(), 18),
      0,
      0,
      walletIns.address,
      "111111111111111111111"
    );
    await tx.wait();
    console.log("SWL-BUSD add liquidity tx: ", tx.hash);
}

const swapSWLForBNB = async(
  pairInstance,
  inputTokenIns, 
  wallet,
  routerInstance,
  swapAmount
) => {
      console.log("----------------------- Swap SWL For BNB ---------------------");
      await displayLiquidityPoolBalance("SWL-BNB Pool:", pairInstance);

      let balance = await ethers.provider.getBalance(wallet.address);
      console.log(">>> old balance: ", ethers.utils.formatEther(balance));

      let tx = await inputTokenIns.connect(wallet).approve(
          routerInstance.address,
          ethers.utils.parseUnits(Number(swapAmount+100).toString(), 18)
      );
      await tx.wait();
      console.log("SWL-BNB Swap Approved Tx: ", tx.hash);

      let amountIn = ethers.utils.parseUnits(Number(swapAmount).toString(), 18);
      let wEth = await routerInstance.WETH();
      let amountsOut = await routerInstance.getAmountsOut(
        amountIn,
        [ inputTokenIns.address, wEth ]
      );
      console.log("excepted swap balance: ", ethers.utils.formatEther(amountsOut[1]));

      tx = await routerInstance.connect(wallet).swapExactTokensForETHSupportingFeeOnTransferTokens(
        amountIn, 0,
        [ inputTokenIns.address, wEth ],
        wallet.address,
        "990000000000000000000"
      );
      await tx.wait();
      console.log("SWL-BNB Swapped Tx: ", tx.hash);
      balance = await ethers.provider.getBalance(wallet.address);
      console.log(">>> new balance: ", ethers.utils.formatEther(balance));
      await displayLiquidityPoolBalance("SWL-BNB Pool:", pairInstance);
}

const swapSWLForBUSD = async(
  pairInstance,
  inputTokenIns,
  outTokenIns,
  wallet,
  routerInstance,
  swapAmount
) => {
      console.log("----------------------- Swap SWL For BUSD ---------------------");
      await displayLiquidityPoolBalance("SWL-BUSD Pool:", pairInstance);

      let balance = await outTokenIns.balanceOf(wallet.address);
      console.log(">>> old balance by BUSD: ", ethers.utils.formatEther(balance));

      let tx = await inputTokenIns.connect(wallet).approve(
          routerInstance.address,
          ethers.utils.parseUnits(Number(swapAmount+100).toString(), 18)
      );
      await tx.wait();
      console.log("SWL-BUSD Swap Approved Tx: ", tx.hash);

      let amountIn = ethers.utils.parseUnits(Number(swapAmount).toString(), 18);
      let amountsOut = await routerInstance.getAmountsOut(
        amountIn,
        [
          inputTokenIns.address, 
          outTokenIns.address
        ]
      );
      console.log("excepted swap balance: ", ethers.utils.formatEther(amountsOut[1]));

      tx = await routerInstance.connect(wallet).swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountIn,
        0,
        [
          inputTokenIns.address,
          outTokenIns.address
        ],
        wallet.address,
        "99000000000000000000"
      );
      await tx.wait();
      console.log("SWL-BUSD Swapped Tx: ", tx.hash);

      balance = await outTokenIns.balanceOf(wallet.address);
      console.log(">>> new balance by BUSD: ", ethers.utils.formatEther(balance));
      await displayLiquidityPoolBalance("SWL-BUSD Pool:", pairInstance);
}

async function main() {

    const { getNamedAccounts } = hre;
    const { getContractFactory, getSigners } = ethers;

    let {
      Router,
      AutoLiquidityReceiver,
      TreasuryReceiver,
      SafetyFundReceiver,
      CharityReceiver,
      BUSD,
      SWELLO
    } = await getNamedAccounts();

    [owner, user1, user2] = await getSigners();

    const chainId = parseInt(await getChainId(), 10);

    dim('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
    dim('Swello Contracts - Deploy Script');
    dim('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');

    dim(`Network: ${chainName(chainId)}`);

    console.log("owner:", owner.address);
    console.log("user1:", user1.address);
    console.log("user2:", user2.address);
    console.log("chain id:", chainId);

    const options = {
      deployBUSD: true,

      deploySWL: true,

      testTransfer: true,

      testAddLiquidity: true,

      testSwap: true,
    }

    let busdAddress = BUSD;
    if(options.deployBUSD) {
      const BusdContract = await ethers.getContractFactory('BEP20Token');
      const busdIns = await BusdContract.deploy();
      await busdIns.deployed();
      displayResult("Busd Token Address: ", busdIns);
      await displayTokenInfo(busdIns);
      busdAddress = busdIns.address;
    }
    const busdIns = await ethers.getContractAt('BEP20Token', busdAddress);

    let swlAddress = SWELLO;
    if(options.deploySWL) {
      const SwelloContract = await ethers.getContractFactory('Swello');
      const swlIns = await SwelloContract.deploy(
        Router,
        busdAddress,
        AutoLiquidityReceiver,
        TreasuryReceiver,
        SafetyFundReceiver,
        CharityReceiver
      );
      await swlIns.deployed();
      displayResult("Swello Token Address: ", swlIns);
      await displayTokenInfo(swlIns);
      swlAddress = swlIns.address;

      let tx = await swlIns.setInitialDistributionFinished(true);
      await tx.wait();
      console.log("Initial Distribution completion tx: ", tx.hash);
    }
    const swlIns = await ethers.getContractAt('Swello', swlAddress);

    if(options.testTransfer) {

      let tranferTx =  await swlIns.transfer(
        user1.address,
        ethers.utils.parseUnits("100000", 18)
      );
      await tranferTx.wait();
      console.log("SWL: owner -> user1 tx: ", tranferTx.hash);
      await displayWalletBalances(swlIns, true, true, true); 

      tranferTx =  await swlIns.transfer(
        user2.address,
        ethers.utils.parseUnits("100000", 18)
      );
      await tranferTx.wait();
      console.log("SWL: owner -> user2 tx: ", tranferTx.hash);
      await displayWalletBalances(swlIns, true, true, true);

      tranferTx =  await busdIns.transfer(
        user1.address,
        ethers.utils.parseUnits("100000", 18)
      );
      await tranferTx.wait();
      console.log("BUSD: owner -> user1 tx: ", tranferTx.hash);
      await displayWalletBalances(busdIns, true, true, true); 

      tranferTx =  await busdIns.transfer(
        user2.address,
        ethers.utils.parseUnits("100000", 18)
      );
      await tranferTx.wait();
      console.log("BUSD: owner -> user2 tx: ", tranferTx.hash);
      await displayWalletBalances(busdIns, true, true, true); 
      
    }

    if(options.testAddLiquidity) {
      let routerInstance = new ethers.Contract(
        Router, uniswapRouterABI, owner
      );
      let pairSwlBnbAddr = await swlIns.pair();
      console.log("SWL-BNB LP token address: ", pairSwlBnbAddr);
      let pairSwlBusdAddr = await swlIns.pairBusd();
      console.log("SWL-BUSD LP token address: ", pairSwlBusdAddr);
      let pairSwlBnbIns = new ethers.Contract(pairSwlBnbAddr, uniswapPairABI, owner);
      let pairSwlBusdIns = new ethers.Contract(pairSwlBusdAddr, uniswapPairABI, owner);

      await addLiquidityToPools(
        swlIns, busdIns, routerInstance, owner, 10000, 0.2, 1000000, 1000000
      );
      await displayLiquidityPoolBalance("\nSWL-BNB Pool Reserves: ", pairSwlBnbIns);
      await displayLiquidityPoolBalance("\nSWL-BUSD Pool Reserves: ", pairSwlBusdIns);

      await addLiquidityToPools(
        swlIns, busdIns, routerInstance, user1, 5000, 0.1, 10000, 10000
      );
      await displayLiquidityPoolBalance("\nSWL-BNB Pool Reserves: ", pairSwlBnbIns);
      await displayLiquidityPoolBalance("\nSWL-BUSD Pool Reserves: ", pairSwlBusdIns);      
    }

    if(options.testSwap) {
      let routerInstance = new ethers.Contract(
        Router, uniswapRouterABI, owner
      );
      let pairSwlBnbAddr = await swlIns.pair();
      let pairSwlBusdAddr = await swlIns.pairBusd();
      let pairSwlBnbIns = new ethers.Contract(pairSwlBnbAddr, uniswapPairABI, owner);
      let pairSwlBusdIns = new ethers.Contract(pairSwlBusdAddr, uniswapPairABI, owner);

      await swapSWLForBNB(pairSwlBnbIns, swlIns, user1, routerInstance, 500);
      await swapSWLForBUSD(pairSwlBusdIns, swlIns, busdIns, user2, routerInstance, 1000);      
    }

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
