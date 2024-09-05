import { KeyboardEvent, MouseEvent, ReactNode, useId } from "react";

import styles from "./basic.module.css";

export function Button({
    children, on_click,
    disabled, classes,
}: {
    children: ReactNode,
    on_click: (e: MouseEvent) => any,
    disabled?: boolean,
    classes?: string[],
}) {
    return (<button
        onClick={on_click}
        disabled={disabled}
        className={gen_classname(styles.common_input, styles.button, ...classes ?? [])}
    >
        {children}
    </button>)
}

const gen_onkeydown_from_onenter = (on_enter: () => any) => (e: KeyboardEvent) => { if (e.key === "Enter") on_enter() }
const gen_classname = (...classes: string[]) => classes.join(" ")

export const STYLE_JOIN_TO_RIGHT = styles.join_to_right

export function TextInput({
    value, set_value,
    on_enter,
    disabled, classes,
}: {
    value: string,
    set_value: (value: string) => any,
    on_enter?: () => any,
    disabled?: boolean,
    classes?: string[],
}) {
    return (<input
        value={value}
        onChange={e => set_value(e.currentTarget.value)}
        onKeyDown={on_enter && gen_onkeydown_from_onenter(on_enter)}
        disabled={disabled}
        className={gen_classname(styles.common_input, styles.input, ...classes ?? [])}
    />)
}
export function NumberInput({
    value, set_value,
    on_enter,
    disabled, classes,
    is_slider,
    min, max, step,
    label,
}: {
    value: number,
    set_value: (value: number) => any,
    on_enter?: () => any,
    disabled?: boolean,
    classes?: string[],
    min: number,
    max: number,
    step: number,
    is_slider?: boolean,
    label?: ReactNode,
}) {
    const id = useId()
    const input = (<input
        id={id}
        value={value}
        type={(is_slider ?? false) ? "range" : "number"}
        min={min}
        max={max}
        step={step}
        onChange={e => set_value(e.currentTarget.valueAsNumber)}
        onKeyDown={on_enter && gen_onkeydown_from_onenter(on_enter)}
        disabled={disabled}
        className={gen_classname(styles.common_input, styles.input, ...classes ?? [])}
    />)
    return (label != null
        ? (<label htmlFor={id}>
            {label}
            {input}
        </label>)
        : input
    )
}
export function LabelText({
    children,
}: {
    children: ReactNode,
}) {
    return (<span className={`${styles.common_input} ${styles.label} ${styles.join_to_right}`}>
        {children}
    </span>)
}