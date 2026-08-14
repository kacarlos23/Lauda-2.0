Option Explicit

Dim shell, fileSystem, projectRoot, batchFile, command, exitCode
Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

projectRoot = fileSystem.GetParentFolderName(fileSystem.GetParentFolderName(WScript.ScriptFullName))
batchFile = fileSystem.BuildPath(projectRoot, "start-laudaapp.bat")
command = """" & batchFile & """ --foreground"

exitCode = shell.Run(command, 0, True)
WScript.Quit exitCode
