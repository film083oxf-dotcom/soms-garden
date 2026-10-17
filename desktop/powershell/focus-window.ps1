# focus-window.ps1 — ดึงหน้าต่างขึ้นมาหน้าสุดตามชื่อที่ระบุ
#
# ชื่อหน้าต่างเข้ามาผ่าน parameter เท่านั้น (powershell -File ... -WindowTitle <argv>)
# ไม่มีการต่อเข้าสคริปต์ → ชื่อมี ; ` $( " ไร้พิษภัย
#
# ผลลัพธ์: JSON {"found":bool,"title":string,"restored":bool,"foreground":bool}
# exit code: 0 = สำเร็จ · 2 = ไม่พบชื่อที่ตรง · 3 = พบแต่ดึงขึ้นหน้าสุดไม่ได้
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$WindowTitle
)

$ErrorActionPreference = 'Stop'

# ส่งผลลัพธ์เป็น UTF-8 เพื่อให้ Node อ่าน/เขียนชื่อหน้าต่างไทยได้ถูกต้อง
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class SomWin32Focus {
  private delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);

  [DllImport("user32.dll")]
  private static extern bool EnumWindows(EnumProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")]
  private static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")]
  private static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern int GetWindowTextLength(IntPtr hWnd);
  [DllImport("user32.dll")]
  private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")]
  private static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")]
  private static extern bool BringWindowToTop(IntPtr hWnd);
  [DllImport("user32.dll")]
  private static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")]
  private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("kernel32.dll")]
  private static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")]
  private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

  private static IntPtr found = IntPtr.Zero;
  private static string wanted = string.Empty;

  // หาหน้าต่างแรกที่ชื่อตรงเป๊ะแบบไม่สนตัวพิมพ์ (visible หรือ minimize อยู่ก็ได้)
  public static IntPtr FindByTitle(string title) {
    found = IntPtr.Zero;
    wanted = (title == null ? string.Empty : title).Trim();
    EnumWindows(delegate(IntPtr h, IntPtr lParam) {
      int len = GetWindowTextLength(h);
      if (len <= 0) return true;
      var sb = new StringBuilder(len + 1);
      GetWindowText(h, sb, sb.Capacity);
      string t = sb.ToString().Trim();
      if (t.Length == 0) return true;
      if (!IsWindowVisible(h) && !IsIconic(h)) return true;
      if (string.Equals(t, wanted, StringComparison.OrdinalIgnoreCase)) {
        found = h;
        return false;
      }
      return true;
    }, IntPtr.Zero);
    return found;
  }

  // restore ถ้าย่ออยู่ แล้วดึงขึ้นหน้าสุด (แนบ thread input เพื่อข้าม foreground lock ของ Windows)
  public static bool BringToFront(IntPtr h) {
    bool restored = false;
    if (IsIconic(h)) {
      ShowWindow(h, 9);   // SW_RESTORE
      restored = true;
    }
    uint pid;
    uint targetThread = GetWindowThreadProcessId(h, out pid);
    uint currentThread = GetCurrentThreadId();
    bool attached = false;
    if (targetThread != 0 && targetThread != currentThread) {
      attached = AttachThreadInput(currentThread, targetThread, true);
    }
    try {
      BringWindowToTop(h);
      SetForegroundWindow(h);
    } finally {
      if (attached) AttachThreadInput(currentThread, targetThread, false);
    }
    return restored;
  }

  public static bool IsForeground(IntPtr h) {
    return GetForegroundWindow() == h;
  }
}
"@

try {
  $h = [SomWin32Focus]::FindByTitle($WindowTitle)
  if ($h -eq [IntPtr]::Zero) {
    [Console]::Out.WriteLine('{"found":false,"title":"","restored":false,"foreground":false}')
    exit 2
  }
  $restored = [SomWin32Focus]::BringToFront($h)
  Start-Sleep -Milliseconds 200
  $front = [SomWin32Focus]::IsForeground($h)
  $result = @{
    found      = $true
    title      = $WindowTitle
    restored   = $restored
    foreground = $front
  } | ConvertTo-Json -Compress
  [Console]::Out.WriteLine($result)
  if ($front) { exit 0 } else { exit 3 }
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  [Console]::Out.WriteLine('{"found":false,"title":"","restored":false,"foreground":false}')
  exit 3
}
