# TCP proxy: 5175 -> Docker web on 5173
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, 5175)
$listener.Start()
Write-Host "Dev proxy :5175 -> :5173 ready"

function Forward-Connection($client) {
    try {
        $target = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 5173)
        $cs = $client.GetStream()
        $ts = $target.GetStream()
        $buf1 = New-Object byte[] 65536
        $buf2 = New-Object byte[] 65536
        while ($client.Connected -and $target.Connected) {
            if ($cs.DataAvailable) {
                $n = $cs.Read($buf1, 0, $buf1.Length)
                if ($n -gt 0) { $ts.Write($buf1, 0, $n) }
            }
            if ($ts.DataAvailable) {
                $n = $ts.Read($buf2, 0, $buf2.Length)
                if ($n -gt 0) { $cs.Write($buf2, 0, $n) }
            }
            Start-Sleep -Milliseconds 1
        }
    } finally {
        $client.Close()
    }
}

while ($true) {
    $client = $listener.AcceptTcpClient()
    Start-Job -ScriptBlock ${function:Forward-Connection} -ArgumentList $client | Out-Null
}
