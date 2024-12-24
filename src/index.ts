#! /usr/bin/env node

import { isValidHex, getVanityWallet } from './vanityEth.js'
import ora from 'ora'
import cluster from 'cluster'
import TimeFormat from 'hh-mm-ss'
import Yargs from 'yargs'
import process from 'process'

const argv = await Yargs(process.argv.slice(2))
  .usage("Usage: $0 <command> [options]")
  .example(
    "$0 -p B00B5",
    "get a wallet where address prefix matches B00B5",
  )
  .example(
    "$0 --contract -p ABC",
    "get a wallet where 0 nonce contract address prefix matches the vanity",
  )
  .example("$0 -n 25 -p ABC -s 123", "get 25 vanity wallets")
  .example("$0 -n 1000", "get 1000 random wallets")
  .alias("p", "prefix")
  .string("p")
  .describe("p", "prefix hex string")
  .alias("s", "suffix")
  .string("s")
  .describe("s", "suffix hex string")
  .alias("n", "count")
  .number("n")
  .describe("n", "number of wallets")
  .alias("t", "threads")
  .number("t")
  .describe("t", "thread count")
  .boolean("contract")
  .describe("contract", "contract address for contract deployment")
  .help("h")
  .alias("h", "help")
  .epilog("copyright 2021")
  .argv

if (cluster.isPrimary) { // 主线程处理
  // 准备参数
  const prefix = argv.p ?? ''
  const suffix = argv.s ?? ''
  const numWallets = Math.max(argv.n ?? 1, 1)
  const isContract = argv.contract ?? false
  const threads = argv.t ?? 1

  // 校验参数
  if (!isValidHex(prefix)) {
    console.error(`${prefix} is not valid hexadecimal`)
    process.exit(1)
  }
  if (!isValidHex(suffix)) {
    console.error(`${suffix} is not valid hexadecimal`)
    process.exit(1)
  }

  // 状态输出进度条
  const spinner = ora(`generating vanity address 1 / ${numWallets}`).start()
  // 已经找到了几个钱包
  let walletsFound = 0

  // 总共尝试了几个地址
  let totalTry = 0
  // 预估难度
  const totalDiff = Math.pow(16, prefix.length + suffix.length)
  // 上次成功获取到钱包地址的时间
  let lastSuccTime = Date.now()
  // 上次成功时已经尝试了多少个地址
  let lastRoundTry = 0
  // 上次更新状态的时间
  let lastLogTime = Date.now()
  // 上次更新状态时，尝试了几个地址
  let lastTry = 0

  // 定期更新状态
  setInterval(() => {
    // 计算时间
    const now = Date.now()
    const duration = now - lastLogTime
    const roundDuration = now - lastSuccTime
    lastLogTime = now

    // 计算速度
    const count = totalTry - lastTry
    const roundCount = totalTry - lastRoundTry
    lastTry = totalTry
    const speed = Math.round(count / duration * 1000)
    const roundSpeed = Math.round(roundCount / roundDuration * 1000)

    // 更新状态
    spinner.text = `speed: ${speed}/s, round avg speed: ${roundSpeed}/s, round time: ${(roundDuration / 1000).toFixed(1)}s, ETA: ${TimeFormat.fromS(Math.round(Math.max((totalDiff - roundCount) / roundSpeed, 0)), 'hh:mm:ss')}, round try: ${roundCount} / ${totalDiff} (${(roundCount / totalDiff * 100).toFixed(2)}%), total try: ${totalTry}` // TODO
  }, 1000)

  // 创建工作线程
  for (let i = 0; i < threads; i++) {
    // 创建线程
    const worker_env = { prefix, suffix, isContract }
    const proc = cluster.fork(worker_env)

    // 处理线程消息
    proc.on("message", function (message) {
      // 找到地址时
      if (message.account) {
        // 打印出来
        spinner.succeed(JSON.stringify(message.account))
        // 更新状态
        walletsFound += 1
        lastSuccTime = Date.now()
        lastRoundTry = totalTry
        // 如果已经找够目标数量，退出程序
        if (walletsFound >= numWallets) {
          cleanup()
        }

        // 更新状态显示已找到的地址数
        spinner.text = `generating vanity address ${walletsFound + 1} / ${numWallets}`
        spinner.start()
      } else if (message.counter) { // 增加尝试计数
        totalTry += message.counter
      }
    })
  }
} else { // 子线程处理
  // 获取参数
  const worker_env = process.env

  // 循环生成钱包地址
  while (true) {
    const account = await getVanityWallet(
      worker_env['prefix']!,
      worker_env['suffix']!,
      worker_env['isContract']! === 'true',
      (count: number) => process.send!({ counter: count })
    )

    process.send!({
      account,
    })
  }
}

process.stdin.resume() // TODO ???

/**
 * 退出前清理工作线程
 */
const cleanup = function () {
  for (const id in cluster.workers) cluster.workers![id]?.process.kill()
  process.exit()
}
// 出现各类异常情况时，先清理工作线程，再退出
process.on("exit", cleanup)
process.on("SIGINT", cleanup)
process.on("uncaughtException", cleanup)
