const { inputToConfig } = require("@ethereum-waffle/compiler");
const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const provider = waffle.provider;
const {
  BigNumber,
  constants: { MaxUint256, AddressZero },
} = require("ethers");
const PancakeswapPairABI =
  require("../artifacts/contracts/libs/dexfactory.sol/IPancakeSwapPair.json").abi;

const overrides = {
  gasLimit: 9999999,
};

const MINIMUM_LIQUIDITY = BigNumber.from(10).pow(3);

describe("Do Token test script", function () {
  let owner;
  let wallet0,
    wallet1,
    wallet2,
    wallet3,
    wallet4,
    wallet5,
    wallet6,
    wallet7,
    wallet8;
  let wallet;
  let factory, router, WETH, dotoken;
  let BUSD, WETHPair, fakePair;
  let liquidityReceiver, treasuryReceiver, safetyFundReceiver, charityReceiver;
  const balances = [800, 900, 50, 60, 80, 10, 50, 20, 30];
  const bonfireFee = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  const expandTo18Decimals = (n) => {
    return BigNumber.from(n).mul(BigNumber.from(10).pow(18));
  };

  beforeEach(async () => {
    [
      owner,
      wallet0,
      wallet1,
      wallet2,
      wallet3,
      wallet4,
      wallet5,
      wallet6,
      wallet7,
      wallet8,
      liquidityReceiver,
      treasuryReceiver,
      safetyFundReceiver,
      charityReceiver,
      fakePair,
    ] = await ethers.getSigners();

    wallet = [
      wallet0,
      wallet1,
      wallet2,
      wallet3,
      wallet4,
      wallet5,
      wallet6,
      wallet7,
      wallet8,
    ];
    const balance0ETH = await provider.getBalance(owner.address);
    const PancakeFactory = await ethers.getContractFactory(
      "PancakeSwapFactory"
    );
    factory = await PancakeFactory.deploy(owner.address);

    const _WETH = await ethers.getContractFactory("WETH");
    WETH = await _WETH.deploy();

    await WETH.deposit({ value: expandTo18Decimals(3) });
    let wethamount = await WETH.balanceOf(owner.address);

    const balance0ETHagain = await provider.getBalance(owner.address);

    const Router = await ethers.getContractFactory("PancakeSwapRouter");
    router = await Router.deploy(factory.address, WETH.address);
    const _BUSD = await ethers.getContractFactory("BEP20Token");
    BUSD = await _BUSD.deploy();

    const DOTOKEN = await ethers.getContractFactory("DoToken");
    dotoken = await DOTOKEN.deploy(router.address);

    const WETHPairAddress = await factory.getPair(
      WETH.address,
      dotoken.address
    );
    WETHPair = await ethers.getContractAt(PancakeswapPairABI, WETHPairAddress);

    const doowner = await dotoken.balanceOf(owner.address);

    for (let i = 0; i < 9; i++) {
      await dotoken.transfer(
        wallet[i].address,
        expandTo18Decimals(balances[i])
      );
    }

    let dotokenAmount = expandTo18Decimals(100);
    let ETHAmount = expandTo18Decimals(2);
    const expectedLiquidity = expandTo18Decimals(100);

    await dotoken.approve(router.address, MaxUint256);

    router.addLiquidityETH(
      dotoken.address,
      dotokenAmount,
      0,
      ETHAmount,
      owner.address,
      MaxUint256,
      { ...overrides, value: ETHAmount }
    );

    const token0 = await WETHPair.token0();
    const token1 = await WETHPair.token1();

    // console.log(
    //   "<< -------- LP Pair -------- >>",
    //   await WETHPair.getReserves()
    // );
  });

  describe("tax fee", () => {
    it("Calculate Transfer fee amount)", async () => {
      let swapThresholdval = await dotoken.swapThreshold();

      await dotoken.setdelaytime(0);
      for (let i = 0; i < 10; i++) {
        await dotoken
          .connect(wallet1)
          .transfer(wallet0.address, expandTo18Decimals(50));
      }

      let dotokenReflection = await dotoken.amountReflection();
      expect(dotokenReflection.mul(100).div(swapThresholdval)).to.equal(20);

      await dotoken.connect(wallet1).post();
      await dotoken.connect(wallet2).post();
      await dotoken.connect(wallet3).post();

      await dotoken.connect(wallet4).vote(wallet1.address);

      await dotoken.connect(wallet3).vote(wallet2.address);
      await dotoken.connect(wallet4).vote(wallet2.address);

      await dotoken.connect(wallet4).vote(wallet3.address);
      await dotoken.connect(wallet5).vote(wallet3.address);
      await dotoken.connect(wallet6).vote(wallet3.address);
      await dotoken.connect(wallet7).vote(wallet3.address);

      let postamount = await dotoken.getpostamount();
      let voteamount = await dotoken.getvoteamount();

      await dotoken
        .connect(wallet1)
        .transfer(wallet0.address, expandTo18Decimals(50));

      console.log("-postamount:", postamount);
      console.log("-voteamount :", voteamount);

      console.log("<<< --- Claim Do token for Charity --- >>>");

      await dotoken.connect(wallet2).claimCharity();

      console.log("<<< --- Claim Do token for Voter --- >>>");
      await dotoken.connect(wallet1).claimVote();
      await dotoken.connect(wallet2).claimVote();
      await dotoken.connect(wallet4).claimVote();
      await dotoken.connect(wallet6).claimVote();
      await dotoken.connect(wallet7).claimVote();
      await dotoken.connect(wallet8).claimVote();

      /// second transfer
      for (let i = 0; i < 10; i++) {
        await dotoken
          .connect(wallet0)
          .transfer(wallet1.address, expandTo18Decimals(50));
      }

      await dotoken.connect(wallet1).post();
      await dotoken.connect(wallet2).post();

      await dotoken.connect(wallet4).vote(wallet1.address);
      await dotoken.connect(wallet5).vote(wallet1.address);
      await dotoken.connect(wallet3).vote(wallet1.address);
      await dotoken.connect(wallet2).vote(wallet1.address);

      await dotoken.connect(wallet3).vote(wallet2.address);
      await dotoken.connect(wallet5).vote(wallet2.address);
      await dotoken.connect(wallet4).vote(wallet2.address);
      await dotoken.connect(wallet6).vote(wallet2.address);
      await dotoken.connect(wallet7).vote(wallet2.address);
      await dotoken.connect(wallet8).vote(wallet2.address);

      let postamount1 = await dotoken.getpostamount();
      let voteamount1 = await dotoken.getvoteamount();

      await dotoken
        .connect(wallet1)
        .transfer(wallet0.address, expandTo18Decimals(50));
      console.log("-postamount:", postamount1);
      console.log("-voteamount :", voteamount1);

      console.log("<<<  Claim Do token for Charity  >>>");
      await dotoken.connect(wallet1).claimCharity();
      await dotoken.connect(wallet2).claimCharity();
      await dotoken.connect(wallet3).claimCharity();

      console.log("<<<  Claim Do token for Voter  >>>");
      await dotoken.connect(wallet1).claimVote();
      await dotoken.connect(wallet2).claimVote();
      await dotoken.connect(wallet3).claimVote();
      await dotoken.connect(wallet4).claimVote();
      await dotoken.connect(wallet5).claimVote();
      await dotoken.connect(wallet6).claimVote();
      await dotoken.connect(wallet7).claimVote();
      await dotoken.connect(wallet8).claimVote();

      console.log("<<<   Claim Reflection  >>>");
      await dotoken.connect(wallet0).claimReflection(wallet0.address);
      await dotoken.connect(wallet1).claimReflection(wallet1.address);
      await dotoken.connect(wallet2).claimReflection(wallet2.address);
      await dotoken.connect(wallet3).claimReflection(wallet3.address);
      await dotoken.connect(wallet4).claimReflection(wallet4.address);
      await dotoken.connect(wallet5).claimReflection(wallet5.address);
    });
  });
});
