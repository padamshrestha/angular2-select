import { Component,
    EventEmitter,
    trigger,
    state,
    style,
    transition,
    animate,
    forwardRef,
    ElementRef,
    Renderer,
    ContentChildren,
    ViewChild,
    QueryList,
    Input,
    HostListener,
    Output,
    ChangeDetectorRef,
    AfterViewInit,
    AfterContentChecked }               from '@angular/core';
import { ControlValueAccessor,
    NG_VALUE_ACCESSOR }                 from '@angular/forms';
import { FormGroup,
    FormControl,
    Validators }                        from '@angular/forms';
import { Angular2OptionComponent }      from './option.component';

export interface Selection {
    value: string;
    text: string;
}

@Component({
    selector: 'bm-ng2-select',
    template: `
        <div class="bm-ng2-select-container">
            <md-input
                #internalInput
                autoComplete="off"
                readonly="true"
                [(ngModel)] = "selection.text"
                (focus)="_onEnter($event)"
                placeholder="{{placeholder}}"
                required="{{required}}">
            </md-input>
            <md-icon
                *ngIf="!required && selection.value"
                fontSet="fa"
                fontIcon="fa-times"
                (click)="_clear($event)">
            </md-icon>
            <md-icon
                *ngIf="required || !selection.value"
                fontSet="fa"
                fontIcon="fa-caret-down"
                (click)="_open($event)">
            </md-icon>
            <div class="options"
                [hidden]="!areOptionsVisible"
                [@animateState]="animateState">
                <md-card>
                    <ul>
                        <ng-content></ng-content>
                    </ul>
                </md-card>
            </div>
        </div>
    `,
    styles: [`
        div.bm-ng2-select-container {
          position: relative;
        }

        div.bm-ng2-select-container md-input {
          width: 100%;
          z-index: 1;
        }

        div.bm-ng2-select-container md-icon {
          position: absolute;
          top: 16px;
          right: 0;
          color: rgba(0, 0, 0, 0.38);
          cursor: pointer;
          z-index: 2;
        }

        div.bm-ng2-select-container div.options {
          position: absolute;
          top: 0;
          width: 100%;
          z-index: 3;
          background: white;
        }

        div.bm-ng2-select-container div.options md-card {
          padding: 0;
          max-height: 254px;
          overflow-y: auto;
        }

        div.bm-ng2-select-container div.options md-card ul {
          list-style-type: none;
          padding: 0;
        }
    `],
    animations: [
        trigger('animateState', [
            state('hidden', style({
                opacity: 0,
                height: 0
            })),
            state('visible', style({
                opacity: 1,
                height: 'auto'
            })),
            transition('hidden => visible', animate(300)),
            transition('visible => hidden', animate(150))
        ])
    ],
    providers: [{
        provide: NG_VALUE_ACCESSOR,
        useExisting: forwardRef(() => Angular2SelectComponent),
        multi: true
    }]
})
export class Angular2SelectComponent implements ControlValueAccessor, AfterContentChecked, AfterViewInit {
    @Input() placeholder: string;
    @Input() required: boolean = false;

    @Output() selectionChanged: EventEmitter<string> = new EventEmitter<string>();
    @ViewChild('internalInput') internalInput;
    @ContentChildren(Angular2OptionComponent) options: QueryList<Angular2OptionComponent>;

    private selection: Selection = {
        value: null,
        text: ''
    };
    private areOptionsVisible: boolean = false;
    private animateState: string = 'hidden';

    // to propagate change event to external form
    private propagateChange = (_: any) => { };

    // to propagate touch event to external form
    private propagateTouch = (_: any) => { };

    // information if we have subscribed to all options change events
    private initialized: boolean = false;

    constructor(
        private el: ElementRef,
        private renderer: Renderer,
        private changeDetectionRef: ChangeDetectorRef
    ) { }

    /**
     * Function binds click event to the document. The options will hide whenever
     * user click anywhere outside the selector.
     * TODO: make it as an @Input() so the default behaviour can be configured
     * @param event MouseEvent
     */
    @HostListener('document:click', ['$event'])
    onClick(event) {
        // check if the element that was clicked is contained within this component
        // if not just hide the options
        if (!this.el.nativeElement.contains(event.target))
            this._hideOptions();
    }
    /**
     * Function binds to all options onSelect emitted events.
     * We do it in AfterContentChecked life cycle hook because the options
     * can be loaded asynchronously with some delay. Using initialized flag we
     * make sure we subscribe to it just once.
     */
    ngAfterContentChecked() {
        if (!this.options.length || this.initialized)
            return;

        // mark as initialized
        this.initialized = true;

        // subscribe to all options emitted events
        this.options.forEach((option) => {
            option.onSelect.subscribe(
                value => {
                    this._unselectAllOtherOptions(value);
                    this._markSelectionOnPlaceholder(option);
                    this._hideOptions();
                }
            );
            if (option.selected)
                this.selection.value = option.value;
        });

        // now we can setup text property.
        // we could do this above when looping through options and finding selected one,
        // but it will work only in case we have a property selected in option.
        // in case we use selector in form and set data for it using [(ngModel)]
        // we ahve only value of selection (function writeValue is called before the view is initiaded).
        this._markOptionAsSelected(this.selection.value);
    }

    /*
     * In model driven form if the value is set when initializing the form, eg:
     * person: new FormControl('ANNA') then the life cycle of library is:
     * writeValue (from ControlValueAccessor) -> ngAfterContentChecked -> options ngAfterViewInit.
     * we set the selected text in:
     * a) writeValue (if ngAfterContentChecked already called - this happens in template driven forms)
     * b) ngAfterContentChecked (when we load data asynchronously)
     * but in this case (model driven form) we have no text as it is set in option ngAfterViewInit
     * So we have to set the selection text here if value is set but no text.
     */
    ngAfterViewInit() {
        if (this.selection.value && !this.selection.text) {
            this._markOptionAsSelected(this.selection.value);
            this.changeDetectionRef.detectChanges();
        }
    }

    /**
     * Implementation of ControlValueAccessor interface
     */
    writeValue(value: string) {
        if (value !== undefined) {
            this.selection.value = value;

            // selector was initialized before so to get a selection text
            // we have to do it now
            if (this.initialized && !this.selection.text) {
                this._markOptionAsSelected(this.selection.value);
            }
        }
    }

    /**
     * Implementation of ControlValueAccessor interface
     */
    registerOnChange(fn) {
        this.propagateChange = fn;
    }

    /**
     * Implementation of ControlValueAccessor interface
     */
    registerOnTouched(fn) {
        this.propagateTouch = fn;
    }

    /**
     * Implementation of ControlValueAccessor interface
     */
    setDisabledState(isDisabled: boolean) {
        this.internalInput.disabled = isDisabled
    }

    /**
     * Function looks for specific bm-ng2-option element and mark it as active
     * @param value string value of bm-ng2-option element to be selected
     */
    private _markOptionAsSelected(value: string) {
        // options is undefined when called before view is initiaded
        // which is the first call of writeValue
        if (typeof this.options == 'undefined')
            this.selection.value = value;
        else {
            let option = this.options.filter(opt => {
                return opt.value == value;
            });


            if (option && option.length) {
                option[0].markAsSelected(false);
                this.selection.text = option[0].text;
            }
        }
    }

    /**
     * Function sets the value of select placeholder. It is called after bm-ng2-option is being clicked.
     * @param option Angular2OptionComponent clicked bm-ng2-option
     */
    private _markSelectionOnPlaceholder(option: Angular2OptionComponent) {
        this.selection = {
            value: option.value,
            text: option.text
        };

        this.propagateChange(option.value);
        this.selectionChanged.emit(option.value);
    }

    /**
     * Function loops through all bm-ng2-options and deselects them
     * @param value string value of bm-ng2-option element not to be changed
     */
    private _unselectAllOtherOptions(value: string) {
        this.options.forEach((option) => {
            if (option.value != value)
                option.unselect();
        });
    }


    /**
     * Close selector
     */
    private _hideOptions() {
        this.animateState = 'hidden';
        setTimeout(() => { this.areOptionsVisible = false; }, 300);
    }

    /**
     * Function that is triggered when md-input is focused
     */
    private _onEnter() {
        // when the md-input field get focused than the document is not receiving the click event
        // (maybe because the md-input stops propagating it)
        // in this case we have trigger the click event manually on the component
        // so it will close other open selec boxes as this event is propagated down to document
        let event = new MouseEvent('click', {bubbles: true});
        this.renderer.invokeElementMethod(this.el.nativeElement, 'dispatchEvent', [event]);

        // propagate touch event. Part of ControlValueAccessor interface.
        this.propagateTouch(true);

        // open selector options
        this.areOptionsVisible = true;
        this.animateState = 'visible';
    }

    /**
     * Deselect current selection
     * @param event MouseEvent
     */
    private _clear(event) {
        // we have to stop propagation to not to open the options when
        // clear icon is being clicked
        event.stopPropagation();
        this.selection = {
            value: null,
            text: ''
        };
        // make sure the options are maked ad not active
        this._unselectAllOtherOptions('');
        // emit the event

        this.propagateChange(null);
        this.selectionChanged.emit(null);
    }

    /**
     * Opens options after the arrow icon is being clicked
     * @param event MouseEvent
     */
    private _open(event) {
        event.stopPropagation();
        this.internalInput.focus();
    }
}
