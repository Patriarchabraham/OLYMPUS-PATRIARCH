using System;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace MasterOfMastersStudioInstaller
{
    class Program
    {
        [DllImport("kernel32.dll")]
        static extern IntPtr GetConsoleWindow();

        static void Main(string[] args)
        {
            Console.Title = "INSTALL MASTER OF MASTERS OFFICIAL";
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("===============================================================================");
            Console.WriteLine("   🏆 INSTALL MASTER OF MASTERS OFFICIAL");
            Console.WriteLine("   Sovereign DSP Mastering, 5 Gems, Vocal God & Vintage Mic Locker");
            Console.WriteLine("===============================================================================");
            Console.ResetColor();
            Console.WriteLine();

            try
            {
                string targetDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MasterOfMastersStudioPro");
                Console.WriteLine("[*] Destination Folder: " + targetDir);

                if (!Directory.Exists(targetDir))
                {
                    Directory.CreateDirectory(targetDir);
                }

                Console.ForegroundColor = ConsoleColor.Cyan;
                Console.WriteLine("[1/3] Extracting complete sovereign audio engine...");
                Console.ResetColor();

                // Extract embedded ZIP resource
                Assembly assembly = Assembly.GetExecutingAssembly();
                using (Stream stream = assembly.GetManifestResourceStream("payload.zip"))
                {
                    if (stream == null)
                    {
                        throw new Exception("Payload resource not found inside executable.");
                    }

                    string tempZip = Path.Combine(Path.GetTempPath(), "moms_payload_" + Guid.NewGuid().ToString("N") + ".zip");
                    using (FileStream fs = new FileStream(tempZip, FileMode.Create, FileAccess.Write))
                    {
                        stream.CopyTo(fs);
                    }

                    // Extract ZIP archive
                    ZipFile.ExtractToDirectory(tempZip, targetDir);

                    try { File.Delete(tempZip); } catch { }
                }

                Console.ForegroundColor = ConsoleColor.Cyan;
                Console.WriteLine("[2/3] Creating Desktop & Start Menu Shortcuts...");
                Console.ResetColor();

                // Create Desktop and Start Menu Shortcuts via PowerShell
                string shortcutScript = Path.Combine(targetDir, "installer", "create-clean-shortcuts.ps1");
                if (File.Exists(shortcutScript))
                {
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = "powershell.exe",
                        Arguments = "-ExecutionPolicy Bypass -File \"" + shortcutScript + "\"",
                        WindowStyle = ProcessWindowStyle.Hidden,
                        CreateNoWindow = true,
                        UseShellExecute = false
                    };
                    Process p = Process.Start(psi);
                    p.WaitForExit(10000);
                }

                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("[3/3] Installation completed successfully (100%)!");
                Console.WriteLine();
                Console.WriteLine("===============================================================================");
                Console.WriteLine("  ✅ 'Master of Masters Studio Pro' shortcut created on your Desktop.");
                Console.WriteLine("  Launching application now...");
                Console.WriteLine("===============================================================================");
                Console.ResetColor();

                // Launch App
                string startBat = Path.Combine(targetDir, "scripts", "start-windows.bat");
                if (File.Exists(startBat))
                {
                    ProcessStartInfo startPsi = new ProcessStartInfo
                    {
                        FileName = startBat,
                        WorkingDirectory = targetDir,
                        UseShellExecute = true
                    };
                    Process.Start(startPsi);
                }

                System.Threading.Thread.Sleep(2000);
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine();
                Console.WriteLine("[INSTALLATION ERROR]: " + ex.Message);
                Console.ResetColor();
                Console.WriteLine("Press any key to exit...");
                Console.ReadKey();
            }
        }
    }
}
