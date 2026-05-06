import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

type Props = {
    markdown: string
}

export function TaskDescriptionMarkdown({ markdown }: Props) {
    return (
        <div className="taskMarkdown">
            <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{markdown || ''}</ReactMarkdown>
        </div>
    )
}
