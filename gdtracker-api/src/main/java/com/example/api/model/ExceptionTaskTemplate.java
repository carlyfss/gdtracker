package com.example.api.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ExceptionTaskTemplate {

    public static final String DEFAULT_TITLE_TEMPLATE = "Fix Exception #<EXCEPTION_INDEX>";
    public static final String DEFAULT_DESCRIPTION_TEMPLATE = "```\n<EXCEPTION_TRACE>\n```";

    private String titleTemplate;
    private String descriptionTemplate;
    private String defaultCategoryId;

    public static ExceptionTaskTemplate withDefaults(String defaultCategoryIdOrNull) {
        ExceptionTaskTemplate t = new ExceptionTaskTemplate();
        t.setTitleTemplate(DEFAULT_TITLE_TEMPLATE);
        t.setDescriptionTemplate(DEFAULT_DESCRIPTION_TEMPLATE);
        t.setDefaultCategoryId(defaultCategoryIdOrNull);
        return t;
    }
}
