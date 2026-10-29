"""Local masked credential entry. Workers never access Tk or report raw errors."""
from dataclasses import dataclass
from queue import Empty, Queue
from threading import Thread
import tkinter as tk
from tkinter import ttk

from .wanzhi_client import ProviderError, WanzhiClient
from .wanzhi_config import CONFIG, ConfigError, Settings, registration_settings, save_settings


@dataclass(frozen=True)
class SetupResult:
    saved: bool
    probe_verified: bool
    message: str


def save_and_probe(settings, path=CONFIG, client_factory=WanzhiClient):
    """Probe the exact entered key, never a stale environment override."""
    try:
        save_settings(settings, path)
    except ConfigError as exc:
        message = ('输入含空格、不可见字符或非英文字符，请重新复制完整 Key。'
                   if str(exc) in ('KEY_REQUIRED_OR_INVALID',
                                   'KEY_CONTAINS_CONTROL_OR_NON_ASCII_CHARACTERS_REENTER')
                   else '本机加密保存失败，请检查配置文件与 Windows 用户权限。')
        return SetupResult(False, False, message)
    except Exception:
        return SetupResult(False, False, '本机保存失败；没有输出密钥或详细异常。')
    try:
        client_factory(settings).get_knowledge()
    except ProviderError as exc:
        messages = {
            'HTTP_401': '平台拒绝鉴权，请确认复制的是完整、启用中的 OpenAPI Key。',
            'HTTP_403': '平台拒绝访问，请检查此 Key 的资源权限；这不能单独判定 Key 错误。',
            'HTTP_400': '平台返回请求错误，尚不能确认鉴权成功；需进一步核对接口与配置。',
            'NETWORK_ERROR': '网络连接失败，暂时无法检查平台鉴权。',
        }
        message = messages.get(exc.code, '平台检查未通过，尚未确认鉴权成功。')
        return SetupResult(True, False, '已加密保存。' + message)
    except Exception:
        return SetupResult(True, False, '已加密保存，但平台检查未完成。没有输出密钥或详细异常。')
    return SetupResult(True, True,
                       '已加密保存，知识库只读接口检查通过。\nAgent 对话调用仍需单独联调。')


class SetupWindow:
    def __init__(self, root, path=CONFIG, setup_service=save_and_probe):
        self.root, self.path, self.setup_service = root, path, setup_service
        self.results = Queue()
        self.closed = False
        self.busy = False
        self.poll_id = None
        self.defaults = registration_settings(path)
        root.title('Saker Energy · 万智连接配置')
        root.geometry('680x490')
        root.minsize(610, 460)
        root.protocol('WM_DELETE_WINDOW', self.close)
        panel = ttk.Frame(root, padding=24)
        panel.pack(fill='both', expand=True)
        ttk.Label(panel, text='粘贴一次 Key，点击保存即可', font=('Microsoft YaHei UI', 15)).pack(anchor='w')
        ttk.Label(panel, text='使用万智「OpenAPI Key 管理」中复制的完整密钥。',
                  wraplength=600).pack(anchor='w', pady=(10, 18))
        ttk.Label(panel, text='OpenAPI Key').pack(anchor='w')
        self.key = tk.StringVar()
        self.entry = ttk.Entry(panel, textvariable=self.key, show='●', font=('Segoe UI', 12))
        self.entry.pack(fill='x', pady=(6, 5))
        self.count = tk.StringVar(value='尚未输入')
        ttk.Label(panel, textvariable=self.count).pack(anchor='w')
        self.key.trace_add('write', self.update_count)
        ttk.Label(panel, text='Key 仅在本机加密保存；检查只读取万智知识库接口，不发送诊断任务。',
                  wraplength=600).pack(anchor='w', pady=(12, 8))
        self.advanced_open = tk.BooleanVar(value=False)
        ttk.Checkbutton(panel, text='更多设置（Agent 信息已自动保留，可选模型 Key）',
                        variable=self.advanced_open, command=self.toggle_advanced).pack(anchor='w')
        self.advanced = ttk.Frame(panel)
        self.template = tk.StringVar(value=self.defaults.template_id)
        self.url = tk.StringVar(value=self.defaults.public_url)
        self.model_key = tk.StringVar()
        for label, variable, mask in (
            ('Agent ID', self.template, ''), ('Agent 页面地址', self.url, ''),
            ('可选 Model API Key（留空保留原值）', self.model_key, '●')
        ):
            ttk.Label(self.advanced, text=label).pack(anchor='w', pady=(5, 0))
            ttk.Entry(self.advanced, textvariable=variable, show=mask).pack(fill='x')
        self.actions = ttk.Frame(panel)
        self.actions.pack(fill='x', pady=(18, 8))
        self.save_button = ttk.Button(self.actions, text='保存并检查', command=self.submit)
        self.save_button.pack(side='left')
        ttk.Button(self.actions, text='关闭', command=self.close).pack(side='right')
        self.status = tk.StringVar(value='等待粘贴。输入会显示为圆点，无需在终端操作。')
        ttk.Label(panel, textvariable=self.status, wraplength=600, justify='left').pack(anchor='w', pady=8)
        root.bind('<Return>', lambda event: self.submit())
        self.entry.focus_set()

    def update_count(self, *_):
        size = len(self.key.get())
        self.count.set(f'已输入 {size} 个字符（不显示内容）' if size else '尚未输入')

    def toggle_advanced(self):
        if self.advanced_open.get():
            self.advanced.pack(fill='x', before=self.actions, pady=(8, 0))
            self.root.geometry('680x680')
        else:
            self.advanced.pack_forget()
            self.root.geometry('680x490')

    def submit(self):
        if self.busy or self.closed:
            return
        if not self.key.get().strip():
            self.status.set('请先粘贴完整 OpenAPI Key。')
            self.entry.focus_set()
            return
        settings = Settings(self.key.get().strip(), self.template.get().strip(),
                            self.url.get().strip(), self.defaults.completion_event,
                            self.model_key.get().strip())
        self.busy = True
        self.save_button.state(['disabled'])
        self.entry.state(['disabled'])
        self.status.set('正在加密保存并检查连接，请稍候……')

        def worker():
            try:
                result = self.setup_service(settings, self.path)
            except Exception:
                result = SetupResult(False, False, '配置检查未完成；没有输出详细异常。')
            self.results.put(result)

        Thread(target=worker, daemon=True).start()
        self.poll_id = self.root.after(100, self.poll)

    def poll(self):
        self.poll_id = None
        if self.closed:
            return
        try:
            result = self.results.get_nowait()
        except Empty:
            self.poll_id = self.root.after(100, self.poll)
            return
        self.busy = False
        self.save_button.state(['!disabled'])
        self.entry.state(['!disabled'])
        if result.saved:
            self.key.set('')
            self.model_key.set('')
        self.status.set(result.message)

    def close(self):
        self.closed = True
        if self.poll_id is not None:
            self.root.after_cancel(self.poll_id)
            self.poll_id = None
        self.key.set('')
        self.model_key.set('')
        self.root.update_idletasks()
        self.root.destroy()


def main():
    root = tk.Tk()
    SetupWindow(root)
    root.mainloop()
