export function R() {
    return (
        <button
            onClick={async e => {
                fetch("/api/download_lol").then(v => v.json()).then(console.log)
            }}
        >jhfhjd</button>
    )
}