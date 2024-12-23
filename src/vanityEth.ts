import crypto from 'node:crypto'
import ethUtils from 'ethereumjs-util'

/**
 * 钱包结构定义
 */
interface Wallet {
  address: string, // 公钥(不含 0x)
  privateKey: string, // 私钥(不含 0x)
  contract?: string, // 首个合约地址
}

// GC 间隔(尝试多少个钱包地址后进行一次)
const GC_INTERVAL = 6666

/**
 * 等待一会
 * @param {Number} duration 等待的时间(毫秒)
 */
export function sleep(duration: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, duration))
}

/**
 * 判断输入是否为有效的 Hex 字符串
 * @param input 输入的字符串
 * @returns 输入是否为有效的 Hex 字符串
 */
export function isValidHex(input: string): boolean {
  if (!input.length) return true
  input = input.toUpperCase()
  var re = /^[0-9A-F]+$/g
  return re.test(input)
}

/**
 * 生成随机钱包地址，并返回其公私钥
 * @returns 钱包的公私钥
 */
function getRandomWallet(): Wallet {
  const randbytes = crypto.randomBytes(32)
  const address = ethUtils.privateToAddress(randbytes).toString('hex')
  const privateKey = randbytes.toString('hex')

  return { address, privateKey }
}

/**
 * 生成一个钱包创建的首个合约地址
 * @param address 钱包地址
 * @returns 首个合约地址
 */
function getDeterministicContractAddress(address: string): string {
  return '0x' + ethUtils
      .keccak256(ethUtils.rlp.encode([address, 0]))
      .subarray(12)
      .toString("hex")
}

/**
 * 检测一个钱包地址是否符合要求
 * @param wallet 钱包
 * @param prefix 钱包地址的前缀
 * @param suffix 钱包地址的后缀
 * @param isContract 是否是合约地址模式
 * @returns 是否符合要求
 */
function isValidVanityWallet(wallet: Wallet, prefix: string, suffix: string, isContract: boolean): boolean {
  let address = wallet.address
  if (isContract) {
    const contractAddress = getDeterministicContractAddress(`0x${address}`)
    wallet.contract = contractAddress
    return contractAddress.startsWith(prefix) && contractAddress.endsWith(suffix)
  } else {
    return address.startsWith(prefix) && address.endsWith(suffix)
  }
}

/**
 * 生成一个符合要求的钱包地址
 * @param prefix 钱包地址的前缀
 * @param suffix 钱包地址的后缀
 * @param isContract 是否是合约地址模式
 * @param counter 每尝试一个地址，应该调用一次的函数
 * @returns 获取到的钱包信息
 */
export async function getVanityWallet(prefix: string, suffix: string, isContract: boolean, counter: () => void) {
  if (!isValidHex(prefix)) throw new Error(prefix + " is not valid hexadecimal")
  if (!isValidHex(suffix)) throw new Error(suffix + " is not valid hexadecimal")

  prefix = prefix.toLowerCase()
  suffix = suffix.toLowerCase()

  let loopCount = GC_INTERVAL

  let wallet = getRandomWallet()
  while (!isValidVanityWallet(wallet, prefix, suffix, isContract)) {
    loopCount--
    if (loopCount <= 0) {
      await sleep(6)
      loopCount = GC_INTERVAL
    }

    counter()
    wallet = getRandomWallet()
  }

  return wallet
}
