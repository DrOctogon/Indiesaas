import {
    Document,
    Page,
    StyleSheet,
    Text,
    View,
    renderToBuffer
} from "@react-pdf/renderer"
import type { WeeklyReport } from "@/lib/domains/care/types"

/**
 * Server-only PDF rendering for a weekly report (see BUILD/05 §weekly report).
 *
 * This is a SEPARATE code path from the plain-text email body: the email is a
 * text summary, this is a downloadable, formatted document. `@react-pdf/renderer`
 * is server-only — keep this module out of any `"use client"` file. The exported
 * `renderWeeklyReportPdf` turns a stored `WeeklyReport` into a `Buffer` the
 * download route can stream back with `Content-Type: application/pdf`.
 */

const styles = StyleSheet.create({
    page: {
        paddingVertical: 48,
        paddingHorizontal: 56,
        fontSize: 11,
        lineHeight: 1.5,
        color: "#1f2937"
    },
    header: {
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: "#e5e7eb",
        paddingBottom: 12
    },
    title: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#111827"
    },
    subtitle: {
        fontSize: 11,
        color: "#6b7280",
        marginTop: 4
    },
    section: {
        marginTop: 16
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: "bold",
        color: "#111827",
        marginBottom: 6
    },
    bullet: {
        flexDirection: "row",
        marginBottom: 3
    },
    bulletMark: {
        width: 12,
        color: "#6b7280"
    },
    bulletText: {
        flex: 1
    },
    row: {
        marginBottom: 4
    },
    rowPrimary: {
        fontWeight: "bold"
    },
    rowMeta: {
        color: "#6b7280"
    },
    empty: {
        color: "#9ca3af",
        fontStyle: "italic"
    }
})

interface SectionProps {
    title: string
    children: React.ReactNode
}

function Section({ title, children }: SectionProps) {
    return (
        <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {children}
        </View>
    )
}

interface BulletListProps {
    items: readonly string[]
    emptyLabel: string
}

function BulletList({ items, emptyLabel }: BulletListProps) {
    if (items.length === 0) {
        return <Text style={styles.empty}>{emptyLabel}</Text>
    }
    return (
        <View>
            {items.map((item, index) => (
                <View key={index} style={styles.bullet}>
                    <Text style={styles.bulletMark}>•</Text>
                    <Text style={styles.bulletText}>{item}</Text>
                </View>
            ))}
        </View>
    )
}

const TREND_LABEL: Record<string, string> = {
    up: "improving",
    flat: "steady",
    down: "declining"
}

/** The @react-pdf Document for a single weekly report. */
export function WeeklyReportDocument({ report }: { report: WeeklyReport }) {
    return (
        <Document title={`Weekly Report ${report.weekStart}`}>
            <Page size="A4" style={styles.page}>
                <View style={styles.header}>
                    <Text style={styles.title}>Weekly Care Report</Text>
                    <Text style={styles.subtitle}>
                        {report.weekStart} – {report.weekEnd}
                    </Text>
                </View>

                <Section title="Highlights">
                    <BulletList
                        items={report.highlights}
                        emptyLabel="No highlights recorded."
                    />
                </Section>

                <Section title="Concerns">
                    <BulletList
                        items={report.concerns}
                        emptyLabel="No concerns recorded."
                    />
                </Section>

                <Section title="Goal trends">
                    {report.goalTrends.length === 0 ? (
                        <Text style={styles.empty}>
                            No goal trends recorded.
                        </Text>
                    ) : (
                        report.goalTrends.map((goal, index) => (
                            <View key={index} style={styles.row}>
                                <Text>
                                    <Text style={styles.rowPrimary}>
                                        {goal.code}
                                    </Text>
                                    {goal.value !== undefined
                                        ? ` — ${goal.value}`
                                        : ""}
                                    {goal.trend
                                        ? ` (${TREND_LABEL[goal.trend] ?? goal.trend})`
                                        : ""}
                                </Text>
                                {goal.note ? (
                                    <Text style={styles.rowMeta}>
                                        {goal.note}
                                    </Text>
                                ) : null}
                            </View>
                        ))
                    )}
                </Section>

                <Section title="Appointments attended">
                    {report.apptsAttended.length === 0 ? (
                        <Text style={styles.empty}>None attended.</Text>
                    ) : (
                        report.apptsAttended.map((appt, index) => (
                            <View key={index} style={styles.row}>
                                <Text>
                                    <Text style={styles.rowPrimary}>
                                        {appt.date}
                                    </Text>{" "}
                                    — {appt.provider}
                                </Text>
                                {appt.outcome ? (
                                    <Text style={styles.rowMeta}>
                                        {appt.outcome}
                                    </Text>
                                ) : null}
                            </View>
                        ))
                    )}
                </Section>

                <Section title="Appointments upcoming">
                    {report.apptsUpcoming.length === 0 ? (
                        <Text style={styles.empty}>None upcoming.</Text>
                    ) : (
                        report.apptsUpcoming.map((appt, index) => (
                            <View key={index} style={styles.row}>
                                <Text>
                                    <Text style={styles.rowPrimary}>
                                        {appt.date}
                                    </Text>{" "}
                                    — {appt.provider}
                                </Text>
                                {appt.prep ? (
                                    <Text style={styles.rowMeta}>
                                        Prep: {appt.prep}
                                    </Text>
                                ) : null}
                            </View>
                        ))
                    )}
                </Section>

                <Section title="Household items">
                    <BulletList
                        items={report.householdItems}
                        emptyLabel="No household items."
                    />
                </Section>

                <Section title="Supplies">
                    {report.supplies.length === 0 ? (
                        <Text style={styles.empty}>No supplies needed.</Text>
                    ) : (
                        report.supplies.map((supply, index) => (
                            <View key={index} style={styles.row}>
                                <Text>
                                    <Text style={styles.rowPrimary}>
                                        {supply.item}
                                    </Text>
                                    {supply.cost !== undefined
                                        ? ` — $${supply.cost.toFixed(2)}`
                                        : ""}
                                </Text>
                                {supply.why ? (
                                    <Text style={styles.rowMeta}>
                                        {supply.why}
                                    </Text>
                                ) : null}
                            </View>
                        ))
                    )}
                </Section>

                <Section title="Questions">
                    <BulletList
                        items={report.questions}
                        emptyLabel="No questions."
                    />
                </Section>
            </Page>
        </Document>
    )
}

/** Render a weekly report to a PDF `Buffer` (server-only). */
export async function renderWeeklyReportPdf(
    report: WeeklyReport
): Promise<Buffer> {
    return renderToBuffer(<WeeklyReportDocument report={report} />)
}
