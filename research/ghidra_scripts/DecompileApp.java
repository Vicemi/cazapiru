// Export every function of the current program, decompiled, into one C file (research only, never shipped).
//@category CazaPira
import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.*;
import ghidra.program.model.listing.*;
import java.io.*;

public class DecompileApp extends GhidraScript {
    @Override
    public void run() throws Exception {
        String out = getScriptArgs().length > 0 ? getScriptArgs()[0] : "decompiled.c";
        DecompInterface di = new DecompInterface();
        di.openProgram(currentProgram);
        try (PrintWriter pw = new PrintWriter(new BufferedWriter(new FileWriter(out)))) {
            FunctionIterator it = currentProgram.getFunctionManager().getFunctions(true);
            int n = 0;
            while (it.hasNext() && !monitor.isCancelled()) {
                Function f = it.next();
                String nm = f.getName(true);
                if (nm.startsWith("std::") || nm.startsWith("boost::") || nm.startsWith("luabind::") || nm.startsWith("__gnu") || nm.startsWith("_GLOBAL") || nm.startsWith("thunk_") || nm.contains("::std::") || nm.contains("boost::") || nm.contains("luabind::") || nm.startsWith("FUN_") && f.getBody().getNumAddresses() < 12) continue;
                DecompileResults r = di.decompileFunction(f, 60, monitor);
                pw.println("// ===== " + f.getName(true) + " @ " + f.getEntryPoint() + " =====");
                if (r != null && r.decompileCompleted()) pw.println(r.getDecompiledFunction().getC());
                else pw.println("// decompile failed");
                n++;
            }
            println("functions: " + n);
        }
    }
}
