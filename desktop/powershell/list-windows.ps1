# list-windows.ps1 — รายชื่อหน้าต่างระดับบนที่มีชื่อ (ใช้โดย node set-status.js --list-windows)
# ไม่รับพารามิเตอร์ใด ๆ และไม่มี string interpolation จากผู้ใช้
# ผลลัพธ์: JSON array ของชื่อหน้าต่าง  ["ชื่อ A", "ชื่อ B", ...]
$ErrorActionPreference = 'Stop'

# ส่งผลลัพธ์เป็น UTF-8 เพื่อให้ Node อ่านชื่อหน้าต่างภาษาไทยได้ถูกต้อง
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class SomWin32List {
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

  public static string[] ListTitles() {
    var titles = new List<string>();
    EnumWindows(delegate(IntPtr h, IntPtr lParam) {
      int len = GetWindowTextLength(h);
      if (len > 0) {
        var sb = new StringBuilder(len + 1);
        GetWindowText(h, sb, sb.Capacity);
        string t = sb.ToString();
        // เอาเฉพาะหน้าต่างที่มองเห็น หรือย่ออยู่ (IsIconic) — ไม่เอา hidden tool window
        if (!string.IsNullOrWhiteSpace(t) && (IsWindowVisible(h) || IsIconic(h))) {
          titles.Add(t);
        }
      }
      return true;
    }, IntPtr.Zero);
    return titles.ToArray();
  }
}
"@

$titles = [SomWin32List]::ListTitles()
ConvertTo-Json -InputObject @($titles) -Compress
exit 0
