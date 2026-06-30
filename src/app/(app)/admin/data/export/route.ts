import { NextResponse } from "next/server"
import {
    exportWorkspaceData,
    workspaceExportFilename
} from "@/lib/domains/system/export"

/**
 * Per-workspace data export download (admin-only). Streams the guarded
 * `exportWorkspaceData()` dump as a JSON attachment. The action re-guards
 * (`requireManage("workspace", ["admin"])`) and scopes strictly to the active
 * workspace, so a non-admin or cross-tenant request fails closed with the
 * action's failure message and a 403 here. GET so the page can use a plain
 * download link.
 */
export async function GET(): Promise<Response> {
    const result = await exportWorkspaceData()
    if (!result.status) {
        return NextResponse.json(
            { error: result.message ?? "Export failed." },
            { status: 403 }
        )
    }

    const filename = await workspaceExportFilename()
    const body = JSON.stringify(result.data ?? {}, null, 2)

    return new NextResponse(body, {
        status: 200,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store"
        }
    })
}
