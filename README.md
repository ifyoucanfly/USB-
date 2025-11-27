# USB-
# USB 设备管理工具（HarmonyOS / OpenHarmony）

本项目是基于 ArkTS + DevEco Studio 开发的 **USB 设备管理示例应用**，用于演示如何在 HarmonyOS / OpenHarmony 系统上：

- 枚举当前系统可见的 USB 设备
- 查看设备基础信息（VID/PID、类别、协议、版本、总线号等）
- 申请访问权限并对设备执行简单的描述符读取测试
- 通过 UI 展示设备列表和测试结果日志

## 功能特性

- 使用 `usbManager.getDevices()` 获取 USB 设备列表
- 使用 `usbManager.hasRight` / `usbManager.requestRight` 进行权限检查与申请
- 使用 `usbManager.connectDevice` / `usbManager.getRawDescriptor` / `usbManager.closePipe` 进行基础功能性测试
- 在页面上实时显示：
  - 设备名称（productName / name）
  - 厂商 ID（Vendor ID）、产品 ID（Product ID）
  - 设备类别 / 子类别 / 协议 / 版本
  - 总线号（busNum）与设备地址（devAddress）
- 通过定时器轮询模拟检测插拔变更，并输出对应日志

> 当前示例重点在「如何使用 USB 管理 API」，并不包含针对所有设备类型的完整读写协议实现。

---

## 开发环境

- 操作系统：Windows / macOS / Linux（任选其一）
- IDE：DevEco Studio 6.0.1（或兼容版本）
- 语言：ArkTS
- 目标平台：HarmonyOS / OpenHarmony 标准系统，支持 `@kit.BasicServicesKit` 的 USB 能力
- 运行设备：
  - 推荐：真机（支持 USB Host 功能）
  - DevEco 模拟器：可以运行应用和 UI，但通常不会枚举到真实 USB 设备

---

## 工程结构说明

核心页面文件为：

```text

entry/

&nbsp; src/main/ets/pages/

&nbsp;   Index.ets



\#构建与与运行



使用 DevEco Studio 打开本项目



确认工程配置：



entry/src/main/module.json5 中已声明 USB 权限，例如：



"requestPermissions": \[

&nbsp; {

&nbsp;   "name": "ohos.permission.USB\_PERMISSION"

&nbsp; }

]



目标设备类型（deviceTypes）中包含你要运行的设备类型（如 "phone", "tablet", "2in1" 等）



连接一台支持 USB Host 的真机设备，并在 DevEco 中选择该设备作为运行目标



点击「Run」运行 entry 模块



在真机上：



首次操作时系统会弹出 USB 相关权限授权框，请选择「允许」



点击「手动扫描 USB 设备」，查看设备列表和日志输出



选择任意设备点击「测试此设备」，观察测试结果与提示信息



\#使用说明



扫描设备



打开应用后，点击页面中「手动扫描 USB 设备」按钮，应用会调用 usbManager.getDevices() 获取当前系统可见的所有 USB 设备，并在列表中展示。



查看设备信息



列表每一项显示：



设备名称（productName / name）



厂商 ID（Vendor ID）、产品 ID（Product ID）



设备类别 / 子类别 / 协议 / 版本



总线号与设备地址（用于排查多端口、多设备场景）



测试设备



点击「测试此设备」会执行以下步骤：



检查是否已经有访问该设备的权限



如无权限，调用 usbManager.requestRight() 请求权限（系统将弹出对话框）



权限授予后，调用 usbManager.connectDevice() 建立连接



调用 usbManager.getRawDescriptor() 读取设备原始描述符，并做简单解析



在页面日志区域输出测试结果（包括 USB 版本号等信息）



最后调用 usbManager.closePipe() 关闭连接



\#已知限制



DevEco 模拟器通常不会映射宿主机的真实 USB 设备，因此在模拟器中可能始终显示为「检测到 0 个设备」。



示例仅演示基本能力：



不包含对大容量存储（U 盘）、HID 等具体类设备的完整协议读写实现



如果设备实现不符合 USB 标准描述符规范，读取描述符可能失败或返回异常结果



不支持在应用层直接操作系统底层 USB 控制器寄存器（需要驱动/内核级开发）
