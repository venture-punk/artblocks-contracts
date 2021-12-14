import { BN, expectRevert } from "@openzeppelin/test-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

interface RoyaltiesResponse {
  recipients_: Array<String>;
  bps: Array<BN>;
}

// helper function to compare getRoyalties response
const assertRoyaltiesResponse = async (
  response: RoyaltiesResponse,
  recipients_: Array<String>,
  bps: Array<BN>
) => {
  // check recipients
  expect(response.recipients_).to.be.deep.equal(recipients_);
  // check bps
  expect(response.bps.toString())
    .to.be.deep.equal(bps.toString())
    .to.not.equal("");
};

describe("GenArt721RoyaltyOverride_PBAB", async function () {
  const name = "Non Fungible Token PBAB";
  const symbol = "NFT_PBAB";

  const tokenIdProject0 = "0000000";
  const tokenIdProject1 = "1000000";

  const pricePerTokenInWei = ethers.utils.parseEther("1");
  const projectZero = 0;
  const projectOne = 1;

  const addressZero = "0x0000000000000000000000000000000000000000";
  const defaultBps = 250;

  beforeEach(async function () {
    const [
      adminA,
      adminB,
      artist0,
      additional0,
      artist1,
      additional1,
      anyone,
      renderProviderPaymentAddr1,
      renderProviderPaymentAddr2,
      renderProviderPaymentAddr3,
    ] = await ethers.getSigners();
    this.accounts = {
      adminA: adminA,
      adminB: adminB,
      artist0: artist0,
      additional0: additional0,
      artist1: artist1,
      additional1: additional1,
      anyone: anyone,
      renderProviderPaymentAddr1,
      renderProviderPaymentAddr2,
      renderProviderPaymentAddr3,
    };
    const randomizerFactory = await ethers.getContractFactory("Randomizer");
    this.randomizer = await randomizerFactory.deploy();
    const artblocksFactory_PBAB = await ethers.getContractFactory(
      "GenArt721CoreV2_PBAB"
    );
    this.tokenA = await artblocksFactory_PBAB
      .connect(adminA)
      .deploy(name, symbol, this.randomizer.address);

    // set renderProviderAddress for tokenA
    await this.tokenA
      .connect(adminA)
      .updateRenderProviderAddress(
        this.accounts.renderProviderPaymentAddr1.address
      );

    // add projects for artists 0 and 1
    await this.tokenA
      .connect(adminA)
      .addProject("project0_a", artist0.address, pricePerTokenInWei);

    await this.tokenA
      .connect(adminA)
      .addProject("project1_a", artist1.address, pricePerTokenInWei);

    // artist0 set royalty info (with additional payee)
    await this.tokenA
      .connect(artist0)
      .updateProjectSecondaryMarketRoyaltyPercentage(projectZero, 5);
    await this.tokenA
      .connect(artist0)
      .updateProjectAdditionalPayeeInfo(projectZero, additional0.address, 20);

    // artist1 set royalty info (no additional payee)
    await this.tokenA
      .connect(artist1)
      .updateProjectSecondaryMarketRoyaltyPercentage(projectOne, 5);

    // mint a token on each project because accurate royalties may only be looked
    // up for existing (core returns royalties for tokenId=0 on non-existant tokens)
    // use current PBAB minter (legacy)
    const minterFactory_PBAB = await ethers.getContractFactory(
      "GenArt721Minter_PBAB"
    );
    this.minterA = await minterFactory_PBAB.deploy(this.tokenA.address);

    await this.tokenA.connect(adminA).toggleProjectIsActive(projectZero);
    await this.tokenA.connect(adminA).toggleProjectIsActive(projectOne);

    await this.tokenA.connect(adminA).addMintWhitelisted(this.minterA.address);

    await this.tokenA
      .connect(artist0)
      .updateProjectMaxInvocations(projectZero, 15);
    await this.tokenA
      .connect(artist1)
      .updateProjectMaxInvocations(projectOne, 15);

    this.tokenA
      .connect(this.accounts.artist0)
      .toggleProjectIsPaused(projectZero);
    this.tokenA
      .connect(this.accounts.artist1)
      .toggleProjectIsPaused(projectOne);

    await this.minterA
      .connect(this.accounts.anyone)
      .purchase(projectZero, { value: pricePerTokenInWei });

    await this.minterA
      .connect(this.accounts.anyone)
      .purchase(projectOne, { value: pricePerTokenInWei });

    // deploy second core contract with two more projects
    this.tokenB = await artblocksFactory_PBAB
      .connect(adminB)
      .deploy(name, symbol, this.randomizer.address);

    // set renderProviderAddress for tokenB
    await this.tokenB
      .connect(adminB)
      .updateRenderProviderAddress(
        this.accounts.renderProviderPaymentAddr1.address
      );

    // add projects for artists 0 and 1
    await this.tokenB
      .connect(adminB)
      .addProject("project0_b", artist0.address, pricePerTokenInWei);

    await this.tokenB
      .connect(adminB)
      .addProject("project1_b", artist1.address, pricePerTokenInWei);

    // artist0 set royalty info (with additional payee)
    await this.tokenB
      .connect(artist0)
      .updateProjectSecondaryMarketRoyaltyPercentage(projectZero, 10);
    await this.tokenB
      .connect(artist0)
      .updateProjectAdditionalPayeeInfo(projectZero, additional0.address, 60);

    // artist1 set royalty info (no additional payee)
    await this.tokenB
      .connect(artist1)
      .updateProjectSecondaryMarketRoyaltyPercentage(projectOne, 10);

    // mint a token on each project because accurate royalties may only be looked
    // up for existing (core returns royalties for tokenId=0 on non-existant tokens)
    this.minterB = await minterFactory_PBAB.deploy(this.tokenB.address);

    await this.tokenB.connect(adminB).toggleProjectIsActive(projectZero);
    await this.tokenB.connect(adminB).toggleProjectIsActive(projectOne);

    await this.tokenB.connect(adminB).addMintWhitelisted(this.minterB.address);

    await this.tokenB
      .connect(artist0)
      .updateProjectMaxInvocations(projectZero, 15);
    await this.tokenB
      .connect(artist1)
      .updateProjectMaxInvocations(projectOne, 15);

    this.tokenB
      .connect(this.accounts.artist0)
      .toggleProjectIsPaused(projectZero);
    this.tokenB
      .connect(this.accounts.artist1)
      .toggleProjectIsPaused(projectOne);

    await this.minterB
      .connect(this.accounts.anyone)
      .purchase(projectZero, { value: pricePerTokenInWei });

    await this.minterB
      .connect(this.accounts.anyone)
      .purchase(projectOne, { value: pricePerTokenInWei });

    // deploy PBAB royalty override
    const royaltyOverrideFactory_PBAB = await ethers.getContractFactory(
      "GenArt721RoyaltyOverride_PBAB"
    );
    this.royaltyOverride = await royaltyOverrideFactory_PBAB
      .connect(anyone)
      .deploy();
  });

  describe("supports ERC165 interface", async function () {
    it("supports getRoyalties(address,uint256) interface", async function () {
      expect(
        await this.royaltyOverride
          .connect(this.accounts.anyone)
          .supportsInterface("0x9ca7dc7a")
      ).to.be.true;
    });

    it("does not support invalid interface", async function () {
      expect(
        await this.royaltyOverride
          .connect(this.accounts.anyone)
          .supportsInterface("0xffffffff")
      ).to.be.false;
    });
  });

  describe("initializes correctly", async function () {
    it("returns correct initial royalties", async function () {
      // tokenA, project 0
      let response = await this.royaltyOverride
        .connect(this.accounts.anyone)
        .getRoyalties(this.tokenA.address, tokenIdProject0);
      assertRoyaltiesResponse(
        response,
        [
          this.accounts.artist0.address,
          this.accounts.additional0.address,
          this.accounts.renderProviderPaymentAddr1.address,
        ],
        [new BN(400), new BN(100), new BN(defaultBps)]
      );
      // tokenA, project 1
      response = await this.royaltyOverride
        .connect(this.accounts.anyone)
        .getRoyalties(this.tokenA.address, tokenIdProject1);
      assertRoyaltiesResponse(
        response,
        [
          this.accounts.artist1.address,
          addressZero,
          this.accounts.renderProviderPaymentAddr1.address,
        ],
        [new BN(500), new BN(0), new BN(defaultBps)]
      );
      // tokenB, project 0
      response = await this.royaltyOverride
        .connect(this.accounts.anyone)
        .getRoyalties(this.tokenB.address, tokenIdProject0);
      assertRoyaltiesResponse(
        response,
        [
          this.accounts.artist0.address,
          this.accounts.additional0.address,
          this.accounts.renderProviderPaymentAddr1.address,
        ],
        [new BN(400), new BN(600), new BN(defaultBps)]
      );
      // tokenB, project 1
      response = await this.royaltyOverride
        .connect(this.accounts.anyone)
        .getRoyalties(this.tokenB.address, tokenIdProject1);
      assertRoyaltiesResponse(
        response,
        [
          this.accounts.artist1.address,
          addressZero,
          this.accounts.renderProviderPaymentAddr1.address,
        ],
        [new BN(1000), new BN(0), new BN(defaultBps)]
      );
    });
  });

  describe("reflects artist's updated royalties", async function () {
    it("reflects artist setting their royalties to zero and back", async function () {
      // artist set royalties to zero
      await this.tokenA
        .connect(this.accounts.artist0)
        .updateProjectSecondaryMarketRoyaltyPercentage(projectZero, 0);
      // check royalties response tokenA, project 0
      let response = await this.royaltyOverride
        .connect(this.accounts.anyone)
        .getRoyalties(this.tokenA.address, tokenIdProject0);
      assertRoyaltiesResponse(
        response,
        [
          this.accounts.artist0.address,
          this.accounts.additional0.address,
          this.accounts.renderProviderPaymentAddr1.address,
        ],
        [new BN(0), new BN(0), new BN(defaultBps)]
      );
      // artist set royalties to non-zero (10 percent)
      await this.tokenA
        .connect(this.accounts.artist0)
        .updateProjectSecondaryMarketRoyaltyPercentage(projectZero, 10);
      // check royalties response tokenA, project 0
      response = await this.royaltyOverride
        .connect(this.accounts.anyone)
        .getRoyalties(this.tokenA.address, tokenIdProject0);
      assertRoyaltiesResponse(
        response,
        [
          this.accounts.artist0.address,
          this.accounts.additional0.address,
          this.accounts.renderProviderPaymentAddr1.address,
        ],
        [new BN(800), new BN(200), new BN(defaultBps)]
      );
    });

    it("reflects artist changing their secondary payee amount", async function () {
      // artist set different secondary payee to 100 percent
      await this.tokenA
        .connect(this.accounts.artist0)
        .updateProjectAdditionalPayeeInfo(
          projectZero,
          this.accounts.additional1.address,
          100
        );
      // check royalties response tokenA, project 0
      let response = await this.royaltyOverride
        .connect(this.accounts.anyone)
        .getRoyalties(this.tokenA.address, tokenIdProject0);
      assertRoyaltiesResponse(
        response,
        [
          this.accounts.artist0.address,
          this.accounts.additional1.address,
          this.accounts.renderProviderPaymentAddr1.address,
        ],
        [new BN(0), new BN(500), new BN(defaultBps)]
      );
      // artist set different secondary payee to 0 percent
      await this.tokenA
        .connect(this.accounts.artist0)
        .updateProjectAdditionalPayeeInfo(
          projectZero,
          this.accounts.additional1.address,
          0
        );
      // check royalties response tokenA, project 0
      response = await this.royaltyOverride
        .connect(this.accounts.anyone)
        .getRoyalties(this.tokenA.address, tokenIdProject0);
      assertRoyaltiesResponse(
        response,
        [
          this.accounts.artist0.address,
          this.accounts.additional1.address,
          this.accounts.renderProviderPaymentAddr1.address,
        ],
        [new BN(500), new BN(0), new BN(defaultBps)]
      );
    });
  });

  describe("core PBAB contract enforces limits on artist's updated royalties", async function () {
    it("enforces limits when artist changes their royalty percentage", async function () {
      // does not revert when setting secondary market royalty to 100%
      await this.tokenA
        .connect(this.accounts.artist0)
        .updateProjectSecondaryMarketRoyaltyPercentage(projectZero, 0);
      // reverts when setting secondary market royalty to >100%
      await expectRevert(
        this.tokenA
          .connect(this.accounts.artist0)
          .updateProjectSecondaryMarketRoyaltyPercentage(projectZero, 101),
        "Max of 100%"
      );
    });

    it("enforces limits when artist changes additional payee percentage", async function () {
      // does not revert when setting additional payee percentage to 100%
      await this.tokenA
        .connect(this.accounts.artist0)
        .updateProjectAdditionalPayeeInfo(
          projectZero,
          this.accounts.additional1.address,
          100
        );
      // reverts when setting additional payee market royalty to >100%
      await expectRevert(
        this.tokenA
          .connect(this.accounts.artist0)
          .updateProjectAdditionalPayeeInfo(
            projectZero,
            this.accounts.additional1.address,
            101
          ),
        "Max of 100%"
      );
    });
  });

  describe("handles changes to core render provider payment address", async function () {
    it("core allows only current core admin to update render provider address", async function () {
      // reverts when non-admin tries to update render provider addr
      await expectRevert(
        this.tokenA
          .connect(this.accounts.anyone)
          .updateRenderProviderAddress(
            this.accounts.renderProviderPaymentAddr2.address
          ),
        "Only admin"
      );
      // core allows admin to update render provider addr
      await this.tokenA
        .connect(this.accounts.adminA)
        .updateRenderProviderAddress(
          this.accounts.renderProviderPaymentAddr2.address
        );
    });

    it("reflects updated core render provider address", async function () {
      // core allows admin to update render provider addr
      await this.tokenA
        .connect(this.accounts.adminA)
        .updateRenderProviderAddress(
          this.accounts.renderProviderPaymentAddr2.address
        );
      // ensure update is reflected in getRoyalties call
      let response = await this.royaltyOverride
        .connect(this.accounts.anyone)
        .getRoyalties(this.tokenA.address, tokenIdProject0);
      assertRoyaltiesResponse(
        response,
        [
          this.accounts.artist0.address,
          this.accounts.additional0.address,
          this.accounts.renderProviderPaymentAddr2.address,
        ],
        [new BN(400), new BN(100), new BN(defaultBps)]
      );
    });
  });

  it("reflects updated render provider address of core contract", async function () {
    // update contract's payment address
    await this.tokenA
      .connect(this.accounts.adminA)
      .updateRenderProviderAddress(
        this.accounts.renderProviderPaymentAddr2.address
      );
    // ensure update is reflected in getRoyalties call
    let response = await this.royaltyOverride
      .connect(this.accounts.anyone)
      .getRoyalties(this.tokenA.address, tokenIdProject0);
    assertRoyaltiesResponse(
      response,
      [
        this.accounts.artist0.address,
        this.accounts.additional0.address,
        this.accounts.renderProviderPaymentAddr2.address,
      ],
      [new BN(400), new BN(100), new BN(defaultBps)]
    );
  });

  describe("handles changes to render provider bps for contract", async function () {
    const legalBps = 200;
    const illegalBps = 10001;
    const zeroBps = 0;
    const maxLegalBps = 10000;
    it("allows only contract admin to update render provider bps for contract", async function () {
      // reverts when non-admin tries to update bps for contract
      await expectRevert(
        this.royaltyOverride
          .connect(this.accounts.adminA)
          .updateRenderProviderBpsForContract(this.tokenB.address, legalBps),
        "Only core admin for specified token contract"
      );
      // emits event when admin updates bps for contract
      await expect(
        this.royaltyOverride
          .connect(this.accounts.adminB)
          .updateRenderProviderBpsForContract(this.tokenB.address, legalBps)
      )
        .to.emit(this.royaltyOverride, "RenderProviderBpsForContractUpdated")
        .withArgs(this.tokenB.address, true, legalBps);
      // reverts when non-admin tries to clear bps for contract
      await expectRevert(
        this.royaltyOverride
          .connect(this.accounts.adminA)
          .clearRenderProviderBpsForContract(this.tokenB.address),
        "Only core admin for specified token contract"
      );
      // emits event when admin clears bps for contract
      await expect(
        this.royaltyOverride
          .connect(this.accounts.adminB)
          .clearRenderProviderBpsForContract(this.tokenB.address)
      )
        .to.emit(this.royaltyOverride, "RenderProviderBpsForContractUpdated")
        .withArgs(this.tokenB.address, false, addressZero);
    });

    it("reflects updated render provider bps for contract", async function () {
      // update contract's bps
      await this.royaltyOverride
        .connect(this.accounts.adminB)
        .updateRenderProviderBpsForContract(this.tokenB.address, legalBps);
      // ensure update is reflected in getRoyalties call
      let response = await this.royaltyOverride
        .connect(this.accounts.anyone)
        .getRoyalties(this.tokenB.address, tokenIdProject0);
      assertRoyaltiesResponse(
        response,
        [
          this.accounts.artist0.address,
          this.accounts.additional0.address,
          this.accounts.renderProviderPaymentAddr1.address,
        ],
        [new BN(400), new BN(600), new BN(legalBps)]
      );
      // clear contract's bps
      await this.royaltyOverride
        .connect(this.accounts.adminB)
        .clearRenderProviderBpsForContract(this.tokenB.address);
      // ensure update is reflected in getRoyalties call
      response = await this.royaltyOverride
        .connect(this.accounts.anyone)
        .getRoyalties(this.tokenB.address, tokenIdProject0);
      assertRoyaltiesResponse(
        response,
        [
          this.accounts.artist0.address,
          this.accounts.additional0.address,
          this.accounts.renderProviderPaymentAddr1.address,
        ],
        [new BN(400), new BN(600), new BN(defaultBps)]
      );
    });

    it("enforces constraints when updating render provider bps for contract", async function () {
      // update contract's bps to minimum value
      await this.royaltyOverride
        .connect(this.accounts.adminB)
        .updateRenderProviderBpsForContract(this.tokenB.address, zeroBps);
      // ensure update is reflected in getRoyalties call
      let response = await this.royaltyOverride
        .connect(this.accounts.anyone)
        .getRoyalties(this.tokenB.address, tokenIdProject0);
      assertRoyaltiesResponse(
        response,
        [
          this.accounts.artist0.address,
          this.accounts.additional0.address,
          this.accounts.renderProviderPaymentAddr1.address,
        ],
        [new BN(400), new BN(600), new BN(zeroBps)]
      );
      // update contract's bps to max legal value
      await this.royaltyOverride
        .connect(this.accounts.adminB)
        .updateRenderProviderBpsForContract(this.tokenB.address, maxLegalBps);
      // ensure update is reflected in getRoyalties call
      response = await this.royaltyOverride
        .connect(this.accounts.anyone)
        .getRoyalties(this.tokenB.address, tokenIdProject0);
      assertRoyaltiesResponse(
        response,
        [
          this.accounts.artist0.address,
          this.accounts.additional0.address,
          this.accounts.renderProviderPaymentAddr1.address,
        ],
        [new BN(400), new BN(600), new BN(maxLegalBps)]
      );
      // expect revert when contract's bps is updated > default bps
      await expectRevert(
        this.royaltyOverride
          .connect(this.accounts.adminB)
          .updateRenderProviderBpsForContract(this.tokenB.address, illegalBps),
        "invalid bps"
      );
    });

    it("allows only contract admin to update render provider bps for project", async function () {
      // reverts when non-admin tries to update bps for project
      await expectRevert(
        this.royaltyOverride
          .connect(this.accounts.adminA)
          .updateRenderProviderBpsForProject(
            this.tokenB.address,
            projectZero,
            legalBps
          ),
        "Only core admin for specified token contract"
      );
      // emits event when admin updates bps for project
      await expect(
        this.royaltyOverride
          .connect(this.accounts.adminB)
          .updateRenderProviderBpsForProject(
            this.tokenB.address,
            projectZero,
            legalBps
          )
      )
        .to.emit(this.royaltyOverride, "RenderProviderBpsForProjectUpdated")
        .withArgs(this.tokenB.address, projectZero, true, legalBps);
      // reverts when non-admin tries to clear bps for project
      await expectRevert(
        this.royaltyOverride
          .connect(this.accounts.adminA)
          .clearRenderProviderBpsForProject(this.tokenB.address, projectZero),
        "Only core admin for specified token contract"
      );
      // emits event when admin clears bps for project
      await expect(
        this.royaltyOverride
          .connect(this.accounts.adminB)
          .clearRenderProviderBpsForProject(this.tokenB.address, projectZero)
      )
        .to.emit(this.royaltyOverride, "RenderProviderBpsForProjectUpdated")
        .withArgs(this.tokenB.address, projectZero, false, zeroBps);
    });

    it("reflects updated render provider bps for project", async function () {
      // update project's payment address
      await this.royaltyOverride
        .connect(this.accounts.adminB)
        .updateRenderProviderBpsForProject(
          this.tokenB.address,
          projectZero,
          legalBps
        );
      // ensure update is reflected in getRoyalties call
      let response = await this.royaltyOverride
        .connect(this.accounts.anyone)
        .getRoyalties(this.tokenB.address, tokenIdProject0);
      assertRoyaltiesResponse(
        response,
        [
          this.accounts.artist0.address,
          this.accounts.additional0.address,
          this.accounts.renderProviderPaymentAddr1.address,
        ],
        [new BN(400), new BN(600), new BN(legalBps)]
      );
      // clear project's bps
      await this.royaltyOverride
        .connect(this.accounts.adminB)
        .clearRenderProviderBpsForProject(this.tokenB.address, projectZero);
      // ensure update is reflected in getRoyalties call
      response = await this.royaltyOverride
        .connect(this.accounts.anyone)
        .getRoyalties(this.tokenB.address, tokenIdProject0);
      assertRoyaltiesResponse(
        response,
        [
          this.accounts.artist0.address,
          this.accounts.additional0.address,
          this.accounts.renderProviderPaymentAddr1.address,
        ],
        [new BN(400), new BN(600), new BN(defaultBps)]
      );
    });

    it("enforces constraints when updating render provider bps for project", async function () {
      // update project's bps to minimum value
      await this.royaltyOverride
        .connect(this.accounts.adminB)
        .updateRenderProviderBpsForProject(
          this.tokenB.address,
          projectZero,
          zeroBps
        );
      // ensure update is reflected in getRoyalties call
      let response = await this.royaltyOverride
        .connect(this.accounts.anyone)
        .getRoyalties(this.tokenB.address, tokenIdProject0);
      assertRoyaltiesResponse(
        response,
        [
          this.accounts.artist0.address,
          this.accounts.additional0.address,
          this.accounts.renderProviderPaymentAddr1.address,
        ],
        [new BN(400), new BN(600), new BN(zeroBps)]
      );
      // update project's bps to max legal value
      await this.royaltyOverride
        .connect(this.accounts.adminB)
        .updateRenderProviderBpsForProject(
          this.tokenB.address,
          projectZero,
          maxLegalBps
        );
      // ensure update is reflected in getRoyalties call
      response = await this.royaltyOverride
        .connect(this.accounts.anyone)
        .getRoyalties(this.tokenB.address, tokenIdProject0);
      assertRoyaltiesResponse(
        response,
        [
          this.accounts.artist0.address,
          this.accounts.additional0.address,
          this.accounts.renderProviderPaymentAddr1.address,
        ],
        [new BN(400), new BN(600), new BN(maxLegalBps)]
      );
      // expect revert when project's bps is updated > default bps
      await expectRevert(
        this.royaltyOverride
          .connect(this.accounts.adminB)
          .updateRenderProviderBpsForProject(
            this.tokenB.address,
            illegalBps,
            illegalBps
          ),
        "invalid bps"
      );
    });

    it("prioritizes project bps over contract bps", async function () {
      // update project's bps
      await this.royaltyOverride
        .connect(this.accounts.adminB)
        .updateRenderProviderBpsForProject(
          this.tokenB.address,
          projectZero,
          legalBps
        );
      // update same contract's bps
      await this.royaltyOverride
        .connect(this.accounts.adminB)
        .updateRenderProviderBpsForContract(this.tokenB.address, zeroBps);
      // ensure project bps is reflected in getRoyalties call
      let response = await this.royaltyOverride
        .connect(this.accounts.anyone)
        .getRoyalties(this.tokenB.address, tokenIdProject0);
      assertRoyaltiesResponse(
        response,
        [
          this.accounts.artist0.address,
          this.accounts.additional0.address,
          this.accounts.renderProviderPaymentAddr1.address,
        ],
        [new BN(400), new BN(600), new BN(legalBps)]
      );
      // ensure contract bps is reflected in untouched project
      response = await this.royaltyOverride
        .connect(this.accounts.anyone)
        .getRoyalties(this.tokenB.address, tokenIdProject1);
      assertRoyaltiesResponse(
        response,
        [
          this.accounts.artist1.address,
          addressZero,
          this.accounts.renderProviderPaymentAddr1.address,
        ],
        [new BN(1000), new BN(0), new BN(zeroBps)]
      );
      // ensure default bps is reflected in untouched contract's project
      response = await this.royaltyOverride
        .connect(this.accounts.anyone)
        .getRoyalties(this.tokenA.address, tokenIdProject0);
      assertRoyaltiesResponse(
        response,
        [
          this.accounts.artist0.address,
          this.accounts.additional0.address,
          this.accounts.renderProviderPaymentAddr1.address,
        ],
        [new BN(400), new BN(100), new BN(defaultBps)]
      );
      // clear project-level bps and ensure contract-level bps is returned
      await this.royaltyOverride
        .connect(this.accounts.adminB)
        .clearRenderProviderBpsForProject(this.tokenB.address, projectZero);
      // ensure contract bps is reflected in getRoyalties call
      response = await this.royaltyOverride
        .connect(this.accounts.anyone)
        .getRoyalties(this.tokenB.address, tokenIdProject0);
      assertRoyaltiesResponse(
        response,
        [
          this.accounts.artist0.address,
          this.accounts.additional0.address,
          this.accounts.renderProviderPaymentAddr1.address,
        ],
        [new BN(400), new BN(600), new BN(zeroBps)]
      );
      // clear contract-level bps and ensure default bps is returned
      await this.royaltyOverride
        .connect(this.accounts.adminB)
        .clearRenderProviderBpsForContract(this.tokenB.address);
      // ensure default bps is reflected in getRoyalties call
      response = await this.royaltyOverride
        .connect(this.accounts.anyone)
        .getRoyalties(this.tokenB.address, tokenIdProject0);
      assertRoyaltiesResponse(
        response,
        [
          this.accounts.artist0.address,
          this.accounts.additional0.address,
          this.accounts.renderProviderPaymentAddr1.address,
        ],
        [new BN(400), new BN(600), new BN(defaultBps)]
      );
      // ensure default bps is reflected in untouched project
      response = await this.royaltyOverride
        .connect(this.accounts.anyone)
        .getRoyalties(this.tokenB.address, tokenIdProject1);
      assertRoyaltiesResponse(
        response,
        [
          this.accounts.artist1.address,
          addressZero,
          this.accounts.renderProviderPaymentAddr1.address,
        ],
        [new BN(1000), new BN(0), new BN(defaultBps)]
      );
    });
  });
});
