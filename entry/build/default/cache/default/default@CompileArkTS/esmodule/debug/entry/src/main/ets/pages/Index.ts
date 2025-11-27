if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface USBManagerPage_Params {
    uiDevices?: Array<DeviceViewModel>;
    realDevices?: Array<usbManager.USBDevice>;
    logText?: string;
    mockMode?: boolean;
    scanTimer?: number;
    lastDeviceCount?: number;
}
import usbManager from "@ohos:usbManager";
import type { BusinessError as BusinessError } from "@ohos:base";
interface DeviceViewModel {
    name: string;
    vendorId: number;
    productId: number;
    clazz: string;
    protocol: string;
    subClass: string;
    version: string;
    busNum: string;
    devAddress: string;
    isMock: boolean; // true=虚拟设备/端口，false=真实设备
}
class USBManagerPage extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__uiDevices = new ObservedPropertyObjectPU([], this, "uiDevices");
        this.realDevices = [];
        this.__logText = new ObservedPropertySimplePU('点击下方按钮扫描 USB 设备', this, "logText");
        this.__mockMode = new ObservedPropertySimplePU(true, this, "mockMode");
        this.scanTimer = undefined;
        this.lastDeviceCount = 0;
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: USBManagerPage_Params) {
        if (params.uiDevices !== undefined) {
            this.uiDevices = params.uiDevices;
        }
        if (params.realDevices !== undefined) {
            this.realDevices = params.realDevices;
        }
        if (params.logText !== undefined) {
            this.logText = params.logText;
        }
        if (params.mockMode !== undefined) {
            this.mockMode = params.mockMode;
        }
        if (params.scanTimer !== undefined) {
            this.scanTimer = params.scanTimer;
        }
        if (params.lastDeviceCount !== undefined) {
            this.lastDeviceCount = params.lastDeviceCount;
        }
    }
    updateStateVars(params: USBManagerPage_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__uiDevices.purgeDependencyOnElmtId(rmElmtId);
        this.__logText.purgeDependencyOnElmtId(rmElmtId);
        this.__mockMode.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__uiDevices.aboutToBeDeleted();
        this.__logText.aboutToBeDeleted();
        this.__mockMode.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    // UI 使用的设备列表（真实 + 虚拟）
    private __uiDevices: ObservedPropertyObjectPU<Array<DeviceViewModel>>;
    get uiDevices() {
        return this.__uiDevices.get();
    }
    set uiDevices(newValue: Array<DeviceViewModel>) {
        this.__uiDevices.set(newValue);
    }
    // 系统真实设备列表，仅在测试真实设备时使用
    private realDevices: Array<usbManager.USBDevice>;
    private __logText: ObservedPropertySimplePU<string>;
    get logText() {
        return this.__logText.get();
    }
    set logText(newValue: string) {
        this.__logText.set(newValue);
    }
    // 是否开启虚拟设备测试模式
    private __mockMode: ObservedPropertySimplePU<boolean>;
    get mockMode() {
        return this.__mockMode.get();
    }
    set mockMode(newValue: boolean) {
        this.__mockMode.set(newValue);
    }
    private scanTimer?: number;
    private lastDeviceCount: number;
    // 页面即将显示
    aboutToAppear() {
        // 首次扫描
        this.refreshUsbDevices();
        // 启动 2 秒一次的轮询扫描
        this.startPeriodicScan();
    }
    // 页面销毁，清理定时器
    aboutToDisappear() {
        if (this.scanTimer !== undefined) {
            clearInterval(this.scanTimer);
            this.scanTimer = undefined;
        }
    }
    /**
     * 启动定时扫描（每 2 秒刷新一次 USB 设备列表）
     */
    private startPeriodicScan() {
        // 避免重复开启多个定时器
        if (this.scanTimer !== undefined) {
            clearInterval(this.scanTimer);
        }
        this.scanTimer = setInterval(() => {
            this.refreshUsbDevices();
        }, 2000);
    }
    /**
     * 刷新 USB 设备列表
     * 调用官方 API：usbManager.getDevices()
     */
    private refreshUsbDevices() {
        try {
            const devices = usbManager.getDevices() as Array<usbManager.USBDevice> | undefined;
            this.realDevices = devices ? [...devices] : [];
            const uiList: Array<DeviceViewModel> = [];
            // 先把真实设备映射成 ViewModel
            this.realDevices.forEach((dev: usbManager.USBDevice) => {
                uiList.push({
                    name: dev.productName ?? dev.name ?? '未知设备',
                    vendorId: dev.vendorId ?? 0,
                    productId: dev.productId ?? 0,
                    clazz: dev.clazz?.toString() ?? '未知',
                    protocol: dev.protocol?.toString() ?? '未知',
                    subClass: dev.subClass?.toString() ?? '未知',
                    version: dev.version ?? '未知',
                    busNum: (dev.busNum ?? 0).toString(),
                    devAddress: (dev.devAddress ?? 0).toString(),
                    isMock: false
                });
            });
            // 如果开启虚拟模式，或者真实设备为空，就追加虚拟设备
            if (this.mockMode || uiList.length === 0) {
                const mocks = this.buildMockDevices();
                uiList.push(...mocks);
            }
            // 更新 UI 列表
            this.uiDevices = uiList;
            // 日志只针对真实设备数量（虚拟的不算）
            const currentRealCount = this.realDevices.length;
            if (this.lastDeviceCount === 0) {
                this.logText = `扫描完成，当前检测到 ${currentRealCount} 个真实 USB 设备（虚拟设备不计入数量）`;
            }
            else if (currentRealCount > this.lastDeviceCount) {
                this.logText = `检测到真实 USB 设备插入，当前共 ${currentRealCount} 个设备`;
            }
            else if (currentRealCount < this.lastDeviceCount) {
                this.logText = `检测到真实 USB 设备拔出，当前共 ${currentRealCount} 个设备`;
            }
            this.lastDeviceCount = currentRealCount;
        }
        catch (err) {
            const error = err as BusinessError;
            this.logText = `获取 USB 设备列表失败: ${error.message ?? JSON.stringify(error)}`;
        }
    }
    /**
     * 测试单个 USB 设备
     * 流程：
     * 1. 检查 / 请求访问权限（usbManager.hasRight / requestRight）
     * 2. connectDevice 获取管道（pipe）
     * 3. getRawDescriptor 读取原始描述符，做简单校验
     * 4. 关闭 pipe
     */
    private async testRealDevice(device: usbManager.USBDevice) {
        let pipe: usbManager.USBDevicePipe | undefined = undefined;
        const deviceName: string = device.name ?? '';
        try {
            if (!deviceName) {
                this.logText = '目标设备的 name 为空，无法申请权限';
                return;
            }
            let hasRight: boolean = false;
            try {
                hasRight = usbManager.hasRight(deviceName);
            }
            catch (err) {
                const error = err as BusinessError;
                this.logText = `检查设备[${deviceName}]权限失败: ${error.message ?? JSON.stringify(error)}`;
                return;
            }
            if (!hasRight) {
                try {
                    hasRight = await usbManager.requestRight(deviceName);
                }
                catch (err) {
                    const error = err as BusinessError;
                    this.logText = `申请设备[${deviceName}]权限失败: ${error.message ?? JSON.stringify(error)}`;
                    return;
                }
            }
            if (!hasRight) {
                this.logText = `用户未授予设备[${deviceName}]的访问权限`;
                return;
            }
            this.logText = `已获得设备[${deviceName}]访问权限，开始测试...`;
            pipe = usbManager.connectDevice(device);
            this.logText = `设备[${deviceName}]已连接，bus=${pipe.busNum}, addr=${pipe.devAddress}，开始读取描述符...`;
            const rawDesc: Uint8Array = usbManager.getRawDescriptor(pipe);
            if (!rawDesc || rawDesc.length === 0) {
                this.logText = `设备[${deviceName}]返回的描述符为空，可能不支持标准描述符读取`;
                return;
            }
            const bLength = rawDesc[0];
            const bDescriptorType = rawDesc[1];
            const bcdUsb = (rawDesc[3] << 8) | rawDesc[2];
            this.logText =
                `设备[${deviceName}]测试成功：` +
                    `原始描述符长度 ${rawDesc.length} 字节；` +
                    `bLength=${bLength}，bDescriptorType=${bDescriptorType}，USB版本=0x${bcdUsb.toString(16)}`;
        }
        catch (err) {
            const error = err as Error;
            this.logText = `测试设备[${deviceName}]失败: ${error.message ?? JSON.stringify(error)}`;
        }
        finally {
            if (pipe !== undefined) {
                try {
                    usbManager.closePipe(pipe);
                }
                catch (e) {
                    console.error(`关闭设备[${deviceName}]失败: ${JSON.stringify(e)}`);
                }
            }
        }
    }
    private async testMockDevice(dev: DeviceViewModel) {
        // 模拟测试耗时
        await new Promise<void>(resolve => setTimeout(resolve, 500));
        if (dev.name.indexOf('无法识别') >= 0) {
            this.logText =
                `虚拟设备[${dev.name}]：设备描述符无法解析。\n` +
                    `建议：\n` +
                    `1. 检查设备是否为标准 USB 设备；\n` +
                    `2. 尝试在其他端口 / 电脑上验证设备是否正常；\n` +
                    `3. 如果是自定义设备，确认固件是否正确实现 USB 描述符。`;
        }
        else if (dev.name.indexOf('读写异常') >= 0) {
            this.logText =
                `虚拟设备[${dev.name}]：控制传输/批量传输出现超时或错误。\n` +
                    `建议：\n` +
                    `1. 检查 USB 线缆、电源供给是否稳定；\n` +
                    `2. 降低传输速度或缩小单次传输数据量；\n` +
                    `3. 在驱动端增加超时重试和错误码上报。`;
        }
        else {
            this.logText =
                `虚拟设备[${dev.name}]：测试通过，模拟读写速率 30 MB/s，错误率 0%。\n` +
                    `可认为当前 USB 管理工具在正常设备场景下工作正常。`;
        }
    }
    private async testDevice(item: DeviceViewModel) {
        if (item.isMock) {
            await this.testMockDevice(item);
            return;
        }
        // 根据 vendorId/productId/name 找到对应真实 USBDevice
        const origin = this.realDevices.find(d => (d.vendorId ?? 0) === item.vendorId &&
            (d.productId ?? 0) === item.productId &&
            (d.productName ?? d.name ?? '') === item.name);
        if (!origin) {
            this.logText = `未在真实设备列表中找到 [${item.name}]，无法执行真实测试`;
            return;
        }
        await this.testRealDevice(origin);
    }
    /**
     * 构造虚拟 USB 端口/设备列表，用于在无真实硬件时测试 UI 和逻辑
     */
    private buildMockDevices(): Array<DeviceViewModel> {
        return [
            {
                name: '端口1: 虚拟U盘',
                vendorId: 0x1234,
                productId: 0x0001,
                clazz: 'MassStorage(0x08)',
                protocol: 'Bulk-Only',
                subClass: 'SCSI(0x06)',
                version: '2.0',
                busNum: '1',
                devAddress: '2',
                isMock: true
            },
            {
                name: '端口2: 虚拟键盘',
                vendorId: 0x1234,
                productId: 0x0002,
                clazz: 'HID(0x03)',
                protocol: 'Keyboard',
                subClass: 'Boot(0x01)',
                version: '1.1',
                busNum: '1',
                devAddress: '3',
                isMock: true
            },
            {
                name: '端口3: 无法识别的设备',
                vendorId: 0xFFFF,
                productId: 0x0003,
                clazz: 'Unknown(0xFF)',
                protocol: 'VendorSpecific',
                subClass: 'Unknown',
                version: '2.0',
                busNum: '2',
                devAddress: '1',
                isMock: true
            },
            {
                name: '端口4: 读写异常设备',
                vendorId: 0x1234,
                productId: 0x0004,
                clazz: 'MassStorage(0x08)',
                protocol: 'Bulk-Only',
                subClass: 'SCSI(0x06)',
                version: '2.0',
                busNum: '2',
                devAddress: '2',
                isMock: true
            }
        ];
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 12 });
            Column.padding(16);
            Column.width('100%');
            Column.height('100%');
            Column.backgroundColor('#FFFFFF');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 标题
            Text.create('USB 设备管理工具');
            // 标题
            Text.fontSize(24);
            // 标题
            Text.fontWeight(FontWeight.Bold);
            // 标题
            Text.margin({ top: 16 });
        }, Text);
        // 标题
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 手动扫描按钮
            Button.createWithLabel('手动扫描 USB 设备');
            // 手动扫描按钮
            Button.backgroundColor('#007DFF');
            // 手动扫描按钮
            Button.fontColor(Color.White);
            // 手动扫描按钮
            Button.onClick(() => {
                this.refreshUsbDevices();
            });
        }, Button);
        // 手动扫描按钮
        Button.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 虚拟设备测试开关按钮（注意：在 Column 里面）
            Button.createWithLabel(this.mockMode ? '关闭虚拟设备测试' : '开启虚拟设备测试');
            // 虚拟设备测试开关按钮（注意：在 Column 里面）
            Button.margin({ top: 8 });
            // 虚拟设备测试开关按钮（注意：在 Column 里面）
            Button.backgroundColor('#999999');
            // 虚拟设备测试开关按钮（注意：在 Column 里面）
            Button.fontColor(Color.White);
            // 虚拟设备测试开关按钮（注意：在 Column 里面）
            Button.onClick(() => {
                this.mockMode = !this.mockMode;
                this.refreshUsbDevices();
            });
        }, Button);
        // 虚拟设备测试开关按钮（注意：在 Column 里面）
        Button.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 日志显示
            Text.create(this.logText);
            // 日志显示
            Text.fontSize(14);
            // 日志显示
            Text.fontColor(Color.Grey);
            // 日志显示
            Text.maxLines(4);
            // 日志显示
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
            // 日志显示
            Text.margin({ top: 8, bottom: 8 });
        }, Text);
        // 日志显示
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 设备列表（注意使用 uiDevices 或你当前的数组）
            List.create();
            // 设备列表（注意使用 uiDevices 或你当前的数组）
            List.height('60%');
            // 设备列表（注意使用 uiDevices 或你当前的数组）
            List.divider({ strokeWidth: 1, color: '#EEEEEE' });
        }, List);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const dev = _item;
                {
                    const itemCreation = (elmtId, isInitialRender) => {
                        ViewStackProcessor.StartGetAccessRecordingFor(elmtId);
                        ListItem.create(deepRenderFunction, true);
                        if (!isInitialRender) {
                            ListItem.pop();
                        }
                        ViewStackProcessor.StopGetAccessRecording();
                    };
                    const itemCreation2 = (elmtId, isInitialRender) => {
                        ListItem.create(deepRenderFunction, true);
                        ListItem.margin({ bottom: 8 });
                    };
                    const deepRenderFunction = (elmtId, isInitialRender) => {
                        itemCreation(elmtId, isInitialRender);
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            Column.create({ space: 4 });
                            Column.padding(12);
                            Column.backgroundColor('#F5F7FA');
                            Column.borderRadius(8);
                        }, Column);
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            Text.create(`设备名称: ${dev.name}`);
                            Text.fontSize(16);
                            Text.fontWeight(FontWeight.Medium);
                        }, Text);
                        Text.pop();
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            Text.create(`厂商ID: 0x${dev.vendorId.toString(16)}  ` +
                                `产品ID: 0x${dev.productId.toString(16)}`);
                            Text.fontSize(14);
                        }, Text);
                        Text.pop();
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            Text.create(`设备类别: ${dev.clazz}  协议: ${dev.protocol}`);
                            Text.fontSize(14);
                        }, Text);
                        Text.pop();
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            Text.create(`子类别: ${dev.subClass}  版本: ${dev.version}`);
                            Text.fontSize(14);
                        }, Text);
                        Text.pop();
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            Text.create(`总线号: ${dev.busNum}  地址: ${dev.devAddress}`);
                            Text.fontSize(14);
                        }, Text);
                        Text.pop();
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            If.create();
                            if (dev.isMock) {
                                this.ifElseBranchUpdateFunction(0, () => {
                                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                                        Text.create('（虚拟设备，仅用于功能验证）');
                                        Text.fontSize(12);
                                        Text.fontColor('#999999');
                                    }, Text);
                                    Text.pop();
                                });
                            }
                            else {
                                this.ifElseBranchUpdateFunction(1, () => {
                                });
                            }
                        }, If);
                        If.pop();
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            Button.createWithLabel('测试此设备');
                            Button.margin({ top: 8 });
                            Button.backgroundColor(dev.isMock ? '#00C689' : '#007DFF');
                            Button.fontColor(Color.White);
                            Button.onClick(() => {
                                this.testDevice(dev);
                            });
                        }, Button);
                        Button.pop();
                        Column.pop();
                        ListItem.pop();
                    };
                    this.observeComponentCreation2(itemCreation2, ListItem);
                    ListItem.pop();
                }
            };
            this.forEachUpdateFunction(elmtId, this.uiDevices, forEachItemGenFunction, (dev: DeviceViewModel) => `${dev.isMock ? 'mock' : 'real'}-${dev.name}-${dev.vendorId}-${dev.productId}`, false, false);
        }, ForEach);
        ForEach.pop();
        // 设备列表（注意使用 uiDevices 或你当前的数组）
        List.pop();
        Column.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "USBManagerPage";
    }
}
registerNamedRoute(() => new USBManagerPage(undefined, {}), "", { bundleName: "com.example.usbdemo", moduleName: "entry", pagePath: "pages/Index", pageFullPath: "entry/src/main/ets/pages/Index", integratedHsp: "false", moduleType: "followWithHap" });
