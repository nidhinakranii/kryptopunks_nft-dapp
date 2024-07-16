const hre = require("hardhat");
const fs = require("fs");
const fse = require("fs-extra");
const path = require("path");
const { verify } = require("../utils/verify");
const { getAmountInWei, developmentChains } = require("../utils/helper-scripts");

async function main() {
  const deployNetwork = hre.network.name;

  // Test URI
  const baseURI = "ipfs://QmeHfivPyobBjSXtVUv2VHCMmugDRfZ7Qv7QfkrG4BWLQz";

  const maxSupply = 30;
  const mintCost = getAmountInWei(0.0001);
  const maxMintAmount = 5;

  // Deploy KryptoPunks NFT contract
  const NFTContract = await ethers.getContractFactory("KryptoPunks");
  const nftContract = await NFTContract.deploy(maxSupply, mintCost, maxMintAmount);
  await nftContract.deployed();

  const set_tx = await nftContract.setBaseURI(baseURI);
  await set_tx.wait();

  // Deploy KryptoPunks ERC20 token contract
  const TokenContract = await ethers.getContractFactory("KryptoPunksToken");
  const tokenContract = await TokenContract.deploy();
  await tokenContract.deployed();

  // Deploy NFTStakingVault contract
  const Vault = await ethers.getContractFactory("NFTStakingVault");
  const stakingVault = await Vault.deploy(nftContract.address, tokenContract.address);
  await stakingVault.deployed();

  const control_tx = await tokenContract.setController(stakingVault.address, true);
  await control_tx.wait();

  console.log("KryptoPunks NFT contract deployed at:\n", nftContract.address);
  console.log("KryptoPunks ERC20 token contract deployed at:\n", tokenContract.address);
  console.log("NFT Staking Vault deployed at:\n", stakingVault.address);
  console.log("Network deployed to :\n", deployNetwork);

  // Transfer contracts addresses & ABIs to the front-end
  const frontendPath = path.resolve(__dirname, "../../front-end/src");
  console.log("Frontend path:", frontendPath);

  if (fs.existsSync(frontendPath)) {
    console.log("Front-end directory exists. Proceeding to copy artifacts...");

    // Clean up previous artifacts
    const artifactsPath = path.join(frontendPath, "artifacts");
    if (fs.existsSync(artifactsPath)) {
      console.log("Removing existing artifacts directory...");
      fs.rmSync(artifactsPath, { recursive: true, force: true });
    }

    // Copy new artifacts
    console.log("Copying artifacts to the front-end...");
    fs.copySync(path.resolve(__dirname, "./artifacts/contracts"), artifactsPath);
    console.log("Artifacts copied successfully.");

    // Write contract addresses to config file
    const configPath = path.join(frontendPath, "utils/contracts-config.js");
    console.log("Writing contract addresses to config file...");
    fs.writeFileSync(configPath, `
      export const stakingContractAddress = "${stakingVault.address}";
      export const nftContractAddress = "${nftContract.address}";
      export const tokenContractAddress = "${tokenContract.address}";
      export const ownerAddress = "${stakingVault.signer.address}";
      export const networkDeployedTo = "${hre.network.config.chainId}";
    `);
    console.log("Contract addresses written successfully.");
  } else {
    console.log("Front-end directory does not exist. Cannot copy artifacts.");
  }

  if (!developmentChains.includes(deployNetwork) && hre.config.etherscan.apiKey[deployNetwork]) {
    console.log("Waiting for 6 blocks for verification...");
    await stakingVault.deployTransaction.wait(6);

    // Args represent contract constructor arguments
    const args = [nftContract.address, tokenContract.address];
    await verify(stakingVault.address, args);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
